package com.mulaerp.product.service;

import lombok.Getter;
import lombok.extern.slf4j.Slf4j;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * WP10: tolerant CSV parser for bulk product import (mirrors {@code BankStatementParser}'s style -
 * header detection over the first few lines, then skip+count unparseable data rows rather than
 * failing the whole file). Expected columns (case/whitespace-insensitive, any order): sku, name,
 * category, costPrice, unitPrice, stockQuantity, and the optional thrift-store columns condition,
 * tags (semicolon or pipe separated, e.g. "jacket;denim"), acquisitionCost, buyPrice (also accepts
 * "buy_price"), warrantyMonths.
 */
@Slf4j
public class ProductCsvParser {

    public record ParsedRow(int lineNumber, String sku, String name, String categoryName,
                             BigDecimal costPrice, BigDecimal unitPrice, Integer stockQuantity,
                             String condition, List<String> tags, BigDecimal acquisitionCost,
                             BigDecimal buyPrice, Integer warrantyMonths) {
    }

    @Getter
    public static class ParseResult {
        private final List<ParsedRow> rows = new ArrayList<>();
        private int skipped = 0;
    }

    public ParseResult parse(InputStream inputStream) throws IOException {
        ParseResult result = new ParseResult();

        List<String> lines = new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(inputStream, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                lines.add(line);
            }
        }

        int headerLineIndex = -1;
        Map<String, Integer> columns = null;
        for (int i = 0; i < lines.size() && i < 10; i++) {
            String line = lines.get(i);
            if (line == null || line.isBlank()) {
                continue;
            }
            Map<String, Integer> candidate = mapHeader(splitCsvLine(line));
            if (candidate.containsKey("sku") && candidate.containsKey("name")) {
                headerLineIndex = i;
                columns = candidate;
                break;
            }
        }

        if (columns == null) {
            // Best-effort fallback: treat the first non-blank line as the header even if it
            // didn't match the expected keywords exactly.
            for (int i = 0; i < lines.size(); i++) {
                if (lines.get(i) != null && !lines.get(i).isBlank()) {
                    headerLineIndex = i;
                    columns = mapHeader(splitCsvLine(lines.get(i)));
                    break;
                }
            }
        }

        if (columns == null || !columns.containsKey("sku") || !columns.containsKey("name")) {
            throw new IllegalArgumentException(
                    "Could not detect product columns - expected a header row with at least sku and name");
        }

        for (int i = headerLineIndex + 1; i < lines.size(); i++) {
            String line = lines.get(i);
            if (line == null || line.isBlank()) {
                continue;
            }

            List<String> fields = splitCsvLine(line);
            ParsedRow row = toRow(i + 1, fields, columns);
            if (row == null) {
                result.skipped++;
            } else {
                result.rows.add(row);
            }
        }

        return result;
    }

    private ParsedRow toRow(int lineNumber, List<String> fields, Map<String, Integer> columns) {
        String sku = trimOrNull(field(fields, columns.get("sku")));
        String name = trimOrNull(field(fields, columns.get("name")));
        if (sku == null || name == null) {
            return null;
        }

        BigDecimal costPrice = parseDecimal(field(fields, columns.get("costprice")));
        BigDecimal unitPrice = parseDecimal(field(fields, columns.get("unitprice")));
        Integer stockQuantity = parseInt(field(fields, columns.get("stockquantity")));
        if (costPrice == null || unitPrice == null || stockQuantity == null) {
            return null;
        }

        String categoryName = columns.containsKey("category")
                ? trimOrNull(field(fields, columns.get("category"))) : null;
        String condition = columns.containsKey("condition")
                ? trimOrNull(field(fields, columns.get("condition"))) : null;
        BigDecimal acquisitionCost = columns.containsKey("acquisitioncost")
                ? parseDecimal(field(fields, columns.get("acquisitioncost"))) : null;
        BigDecimal buyPrice = columns.containsKey("buyprice")
                ? parseDecimal(field(fields, columns.get("buyprice"))) : null;
        Integer warrantyMonths = columns.containsKey("warrantymonths")
                ? parseInt(field(fields, columns.get("warrantymonths"))) : null;

        List<String> tags = null;
        if (columns.containsKey("tags")) {
            String raw = field(fields, columns.get("tags"));
            if (raw != null && !raw.isBlank()) {
                tags = Arrays.stream(raw.split("[;|]"))
                        .map(String::trim)
                        .filter(t -> !t.isEmpty())
                        .collect(Collectors.toList());
            }
        }

        return new ParsedRow(lineNumber, sku, name, categoryName, costPrice, unitPrice, stockQuantity,
                condition, tags, acquisitionCost, buyPrice, warrantyMonths);
    }

    private String field(List<String> fields, Integer idx) {
        if (idx == null || idx >= fields.size()) {
            return null;
        }
        return fields.get(idx);
    }

    private String trimOrNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private Map<String, Integer> mapHeader(List<String> headerFields) {
        Map<String, Integer> idx = new HashMap<>();
        for (int i = 0; i < headerFields.size(); i++) {
            String h = headerFields.get(i).trim().toLowerCase().replaceAll("[\\s_-]", "");
            switch (h) {
                case "sku" -> idx.putIfAbsent("sku", i);
                case "name", "productname" -> idx.putIfAbsent("name", i);
                case "category", "categoryname" -> idx.putIfAbsent("category", i);
                case "costprice", "cost" -> idx.putIfAbsent("costprice", i);
                case "unitprice", "price" -> idx.putIfAbsent("unitprice", i);
                case "stockquantity", "stock", "qty", "quantity" -> idx.putIfAbsent("stockquantity", i);
                case "condition" -> idx.putIfAbsent("condition", i);
                case "tags" -> idx.putIfAbsent("tags", i);
                case "acquisitioncost" -> idx.putIfAbsent("acquisitioncost", i);
                case "buyprice" -> idx.putIfAbsent("buyprice", i);
                case "warrantymonths" -> idx.putIfAbsent("warrantymonths", i);
                default -> { /* unrecognized column - ignored */ }
            }
        }
        return idx;
    }

    private BigDecimal parseDecimal(String raw) {
        if (raw == null) {
            return null;
        }
        String v = raw.trim().replace(",", "");
        if (v.isEmpty()) {
            return null;
        }
        try {
            return new BigDecimal(v);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private Integer parseInt(String raw) {
        if (raw == null) {
            return null;
        }
        String v = raw.trim();
        if (v.isEmpty()) {
            return null;
        }
        try {
            return Integer.valueOf(v);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private List<String> splitCsvLine(String line) {
        List<String> fields = new ArrayList<>();
        StringBuilder sb = new StringBuilder();
        boolean inQuotes = false;
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (c == '"') {
                if (inQuotes && i + 1 < line.length() && line.charAt(i + 1) == '"') {
                    sb.append('"');
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (c == ',' && !inQuotes) {
                fields.add(sb.toString());
                sb.setLength(0);
            } else {
                sb.append(c);
            }
        }
        fields.add(sb.toString());
        return fields;
    }
}
