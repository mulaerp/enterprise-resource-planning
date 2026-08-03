package com.mulaerp.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * OPTIONAL local LLM reranker for trade-in PRODUCT MATCHING ONLY - never pricing. Talks to a
 * locally-running Ollama instance ({@code docker compose --profile ai up -d ollama}, see
 * compose.yaml) over its {@code /api/generate} endpoint with {@code format: "json"} (JSON-
 * constrained decoding), asking it to (a) pick the single best-matching SKU from an
 * already-retrieved candidate list and (b) parse condition/hasBox/accessories hints out of the raw
 * free-text query. Used by {@code TradeInSuggestionService}, which owns the deterministic trigram
 * search + pricing that this class can never influence.
 *
 * <h2>Hard safety rules (all enforced here, not left to the caller)</h2>
 * <ul>
 *   <li><b>Disabled by default</b> ({@code mulaerp.tradein.ai-match.enabled=false}) - {@link
 *   #tryMatch} returns {@code null} immediately when disabled, before touching the {@link
 *   RestClient} field at all, so a disabled feature never even constructs an HTTP client.</li>
 *   <li><b>Never introduces an off-list product</b> - the returned {@code sku} is checked against
 *   the exact candidate list handed in; anything else (a SKU the model invented, or one from a
 *   different query's candidates) is discarded and treated as "no match" ({@link Outcome#applied()}
 *   false), never surfaced to the caller as real.</li>
 *   <li><b>Fail-soft, always</b> - a connection error, timeout, non-2xx, or malformed/unexpected
 *   JSON shape is caught here and logged at INFO (never ERROR/a stack trace) - an absent optional
 *   local service is not an error condition, it's the expected state on any box that hasn't
 *   started the {@code ai} compose profile.</li>
 *   <li><b>Bounded latency</b> - {@code mulaerp.tradein.ai-match.timeout-ms} (default 2000) caps the
 *   read wait; a short fixed connect timeout catches a completely unreachable Ollama fast.</li>
 * </ul>
 */
@Component
@Slf4j
public class OllamaTradeInMatcher {

    private static final int CONNECT_TIMEOUT_MS = 1_000;
    private static final Set<String> VALID_CONDITIONS = Set.of("NEW", "LIKE_NEW", "GOOD", "FAIR", "POOR");

    @Value("${mulaerp.tradein.ai-match.enabled:false}")
    private boolean enabled;

    @Value("${mulaerp.tradein.ai-match.model:qwen2.5:0.5b}")
    private String model;

    @Value("${mulaerp.tradein.ai-match.timeout-ms:2000}")
    private long timeoutMs;

    @Value("${mulaerp.tradein.ai-match.base-url:http://ollama:11434}")
    private String baseUrl;

    private final ObjectMapper objectMapper;

    /** Lazily built, and ONLY if {@link #enabled} - see class javadoc's first hard rule. Guarded by
     * {@code this} rather than a heavier concurrency primitive: built at most a handful of times
     * (once, in practice) per process lifetime, so a little redundant construction under a rare
     * race is a non-issue. */
    private volatile RestClient restClient;

    public OllamaTradeInMatcher(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    /** One already-retrieved candidate, just enough for the model to pick from and for us to
     * validate its answer against - never the full DTO (keeps the prompt tiny and keeps this class
     * decoupled from the pos module's own types). */
    public record Candidate(String sku, String name) {
    }

    /** Result of one match attempt. {@code applied=false} (with every other field but {@code
     * model}/{@code latencyMs} null) whenever the AI didn't produce a usable, validated match -
     * callers simply don't act on it, no explicit fallback branch needed. */
    public record Outcome(boolean applied, String model, long latencyMs, String suggestedSku,
                           String parsedCondition, Boolean parsedHasBox, String parsedAccessories) {
        private static Outcome notApplied(String model, long latencyMs) {
            return new Outcome(false, model, latencyMs, null, null, null, null);
        }
    }

    public boolean isEnabled() {
        return enabled;
    }

    /**
     * Attempts to rerank {@code candidates} for {@code query}. Returns {@code null} when the
     * feature is disabled or there's nothing to match against (no attempt made at all -
     * distinguished from {@link Outcome#applied()} false, which means an attempt was made but
     * didn't produce a validated match). Never throws - every failure mode is caught and folded
     * into a not-applied {@link Outcome}.
     */
    public Outcome tryMatch(String query, List<Candidate> candidates) {
        if (!enabled || candidates == null || candidates.isEmpty() || query == null || query.isBlank()) {
            return null;
        }

        long start = System.nanoTime();
        try {
            String prompt = buildPrompt(query, candidates);
            String rawJson = callOllama(prompt);
            long latencyMs = elapsedMs(start);

            JsonNode parsed = objectMapper.readTree(rawJson);
            String sku = textOrNull(parsed.get("sku"));
            if (sku == null) {
                return Outcome.notApplied(model, latencyMs);
            }
            boolean onList = candidates.stream().anyMatch(c -> c.sku().equals(sku));
            if (!onList) {
                // HARD CONSTRAINT: never let an off-list SKU through, even if everything else about
                // the response looked well-formed.
                log.info("Trade-in AI match discarded - model returned SKU '{}' which is not among "
                        + "the {} candidates it was given; falling back to deterministic ranking only", sku, candidates.size());
                return Outcome.notApplied(model, latencyMs);
            }

            String condition = normalizedConditionOrNull(textOrNull(parsed.get("condition")));
            Boolean hasBox = boolOrNull(parsed.get("hasBox"));
            String accessories = textOrNull(parsed.get("accessories"));
            return new Outcome(true, model, latencyMs, sku, condition, hasBox, accessories);
        } catch (Exception ex) {
            // Timeout, connection refused (Ollama not running), malformed JSON, unexpected shape -
            // all of it. An absent optional local service is not an error - DEBUG/INFO only, never
            // ERROR/a logged stack trace (see class javadoc).
            long latencyMs = elapsedMs(start);
            log.info("Trade-in AI match unavailable ({}ms) - falling back to deterministic ranking only: {}",
                    latencyMs, ex.toString());
            return Outcome.notApplied(model, latencyMs);
        }
    }

    private long elapsedMs(long startNanos) {
        return (System.nanoTime() - startNanos) / 1_000_000;
    }

    private String callOllama(String prompt) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", model);
        body.put("prompt", prompt);
        body.put("format", "json");
        body.put("stream", false);
        body.put("options", Map.of("temperature", 0));

        String responseBody = client().post()
                .uri("/api/generate")
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(String.class);

        if (responseBody == null || responseBody.isBlank()) {
            throw new IllegalStateException("empty response body from Ollama /api/generate");
        }
        JsonNode root;
        try {
            root = objectMapper.readTree(responseBody);
        } catch (Exception ex) {
            throw new IllegalStateException("unparseable Ollama /api/generate response: " + ex.getMessage());
        }
        JsonNode responseField = root.get("response");
        if (responseField == null || !responseField.isTextual()) {
            throw new IllegalStateException("Ollama /api/generate response missing 'response' text field");
        }
        // format:"json" makes the model emit its JSON answer as a string in this field - parse
        // again to get at sku/condition/hasBox/accessories.
        return responseField.asText();
    }

    private RestClient client() {
        RestClient c = restClient;
        if (c == null) {
            synchronized (this) {
                c = restClient;
                if (c == null) {
                    SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
                    factory.setConnectTimeout(CONNECT_TIMEOUT_MS);
                    factory.setReadTimeout((int) Math.min(timeoutMs, Integer.MAX_VALUE));
                    c = RestClient.builder().baseUrl(baseUrl).requestFactory(factory).build();
                    restClient = c;
                }
            }
        }
        return c;
    }

    /** Tiny, JSON-only prompt - the candidate list is the entire universe of valid answers, spelled
     * out explicitly so a 0.5B model has the best chance of staying on-list. */
    private String buildPrompt(String query, List<Candidate> candidates) {
        StringBuilder sb = new StringBuilder();
        sb.append("You are matching a thrift shop trade-in description to ONE catalogue SKU from ")
                .append("the list below. Pick the single best match, or null if none plausibly match. ")
                .append("NEVER invent a SKU that is not listed.\n\nCandidates:\n");
        for (Candidate c : candidates) {
            sb.append("- ").append(c.sku()).append(": ").append(c.name()).append('\n');
        }
        sb.append("\nCustomer description: \"").append(query.replace("\"", "'")).append("\"\n\n")
                .append("Respond with ONLY compact JSON, no other text, matching exactly this schema:\n")
                .append("{\"sku\": string-from-the-list-above-or-null, ")
                .append("\"condition\": one of \"NEW\",\"LIKE_NEW\",\"GOOD\",\"FAIR\",\"POOR\" or null, ")
                .append("\"hasBox\": true, false, or null, ")
                .append("\"accessories\": a short string or null}");
        return sb.toString();
    }

    private String textOrNull(JsonNode node) {
        if (node == null || node.isNull() || !node.isTextual()) {
            return null;
        }
        String text = node.asText().trim();
        return (text.isEmpty() || "null".equalsIgnoreCase(text)) ? null : text;
    }

    private Boolean boolOrNull(JsonNode node) {
        if (node == null || node.isNull() || !node.isBoolean()) {
            return null;
        }
        return node.asBoolean();
    }

    private String normalizedConditionOrNull(String condition) {
        if (condition == null) {
            return null;
        }
        String normalized = condition.trim().toUpperCase();
        return VALID_CONDITIONS.contains(normalized) ? normalized : null;
    }
}
