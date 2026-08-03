package com.mulaerp.customer.service;

import lombok.Getter;
import lombok.extern.slf4j.Slf4j;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * WP10: tolerant CSV parser for bulk customer import (mirrors {@code BankStatementParser}'s style
 * - header detection over the first few lines, then skip+count unparseable data rows rather than
 * failing the whole file). Expected columns (case/whitespace-insensitive, any order): name, email,
 * phone, address (optional). Only {@code name} is mandatory per row.
 */
@Slf4j
public class CustomerCsvParser {

    public record ParsedRow(int lineNumber, String name, String email, String phone, String address) {
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
            if (candidate.containsKey("name")) {
                headerLineIndex = i;
                columns = candidate;
                break;
            }
        }

        if (columns == null) {
            for (int i = 0; i < lines.size(); i++) {
                if (lines.get(i) != null && !lines.get(i).isBlank()) {
                    headerLineIndex = i;
                    columns = mapHeader(splitCsvLine(lines.get(i)));
                    break;
                }
            }
        }

        if (columns == null || !columns.containsKey("name")) {
            throw new IllegalArgumentException(
                    "Could not detect customer columns - expected a header row with at least name");
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
        String name = trimOrNull(field(fields, columns.get("name")));
        if (name == null) {
            return null;
        }

        String email = columns.containsKey("email") ? trimOrNull(field(fields, columns.get("email"))) : null;
        String phone = columns.containsKey("phone") ? trimOrNull(field(fields, columns.get("phone"))) : null;
        String address = columns.containsKey("address") ? trimOrNull(field(fields, columns.get("address"))) : null;

        return new ParsedRow(lineNumber, name, email, phone, address);
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
                case "name", "customername" -> idx.putIfAbsent("name", i);
                case "email" -> idx.putIfAbsent("email", i);
                case "phone", "phonenumber" -> idx.putIfAbsent("phone", i);
                case "address" -> idx.putIfAbsent("address", i);
                default -> { /* unrecognized column - ignored */ }
            }
        }
        return idx;
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
