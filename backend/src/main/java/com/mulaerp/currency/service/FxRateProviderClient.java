package com.mulaerp.currency.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mulaerp.currency.exception.FxProviderException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Fetches MYR -> X exchange rates from a free, keyless FX-rate API, no xe.com scraping involved
 * (xe.com has no free public API and scraping it would be brittle and ToS-hostile - see the
 * fx-rates skill/README note). Tries {@code mulaerp.fx.providers} (comma-separated URLs) in
 * order, falling back to the next on any failure (network error, timeout, non-2xx, unparseable
 * body, or an empty rates map) and only throwing {@link FxProviderException} once every provider
 * in the list has failed.
 *
 * <p>Two response shapes are understood out of the box:
 * <ul>
 *   <li>open.er-api.com: {@code {"result":"success","rates":{"USD":0.21,...}}}
 *   <li>frankfurter.app: {@code {"amount":1,"base":"MYR","date":"...","rates":{"USD":0.21,...}}}
 * </ul>
 * Both simply expose a top-level {@code rates} object of code -&gt; number, so a single parser
 * handles both; only open.er-api.com additionally has a {@code result} field that is checked for
 * "success" when present.
 *
 * <p>Short timeouts (connect 3s / read 5s per {@link SimpleClientHttpRequestFactory}) so a hung
 * provider can't stall a refresh (scheduled or manual-trigger) for long - the caller
 * ({@code FxRateRefreshService}) still has a second provider to fall back to within the same
 * request.
 */
@Component
@Slf4j
public class FxRateProviderClient {

    private static final int CONNECT_TIMEOUT_MS = 3_000;
    private static final int READ_TIMEOUT_MS = 5_000;

    private final List<String> providers;
    private final RestClient restClient;
    private final ObjectMapper objectMapper;

    public FxRateProviderClient(
            @Value("${mulaerp.fx.providers:https://open.er-api.com/v6/latest/MYR,https://api.frankfurter.app/latest?from=MYR}")
            String providersCsv,
            ObjectMapper objectMapper
    ) {
        this.providers = Arrays.stream(providersCsv.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
        this.objectMapper = objectMapper;

        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(CONNECT_TIMEOUT_MS);
        requestFactory.setReadTimeout(READ_TIMEOUT_MS);
        this.restClient = RestClient.builder().requestFactory(requestFactory).build();
    }

    /** Result of a successful fetch: which provider answered, and the code -> rate map it returned. */
    public record FetchResult(String provider, Map<String, BigDecimal> rates) {
    }

    /**
     * Tries each configured provider in order, returning the first one that answers with a
     * non-empty rates map. Throws {@link FxProviderException} (carrying every provider's failure
     * reason) only once the whole list is exhausted - callers must never let this propagate
     * uncaught from a scheduled context (see {@code FxRateRefreshScheduler}).
     */
    public FetchResult fetchRates() {
        if (providers.isEmpty()) {
            throw new FxProviderException("mulaerp.fx.providers is empty - no FX provider configured", List.of());
        }

        List<String> attempted = new ArrayList<>();
        List<String> failures = new ArrayList<>();
        for (String url : providers) {
            attempted.add(url);
            try {
                Map<String, BigDecimal> rates = fetchFrom(url);
                if (rates.isEmpty()) {
                    failures.add(url + ": response had no usable rates");
                    continue;
                }
                return new FetchResult(url, rates);
            } catch (Exception ex) {
                log.warn("FX provider failed, trying next if any: {} - {}", url, ex.getMessage());
                failures.add(url + ": " + ex.getMessage());
            }
        }

        throw new FxProviderException(
                "All FX providers failed: " + String.join("; ", failures),
                attempted
        );
    }

    private Map<String, BigDecimal> fetchFrom(String url) {
        String body = restClient.get().uri(url).retrieve().body(String.class);
        return parse(url, body);
    }

    private Map<String, BigDecimal> parse(String url, String body) {
        if (body == null || body.isBlank()) {
            throw new IllegalStateException("empty response body");
        }

        JsonNode root;
        try {
            root = objectMapper.readTree(body);
        } catch (Exception ex) {
            throw new IllegalStateException("unparseable response: " + ex.getMessage());
        }

        JsonNode result = root.get("result");
        if (result != null && !"success".equalsIgnoreCase(result.asText())) {
            throw new IllegalStateException("provider reported result=" + result.asText());
        }

        JsonNode ratesNode = root.get("rates");
        if (ratesNode == null || !ratesNode.isObject()) {
            throw new IllegalStateException("no 'rates' object in response from " + url);
        }

        Map<String, BigDecimal> rates = new LinkedHashMap<>();
        Iterator<String> fieldNames = ratesNode.fieldNames();
        while (fieldNames.hasNext()) {
            String code = fieldNames.next();
            JsonNode value = ratesNode.get(code);
            if (value != null && value.isNumber()) {
                rates.put(code.toUpperCase(), value.decimalValue());
            }
        }
        return rates;
    }
}
