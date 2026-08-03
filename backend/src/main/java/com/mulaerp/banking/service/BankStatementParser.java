package com.mulaerp.banking.service;

import lombok.Getter;
import lombok.extern.slf4j.Slf4j;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * ACC-BANK: parses a generic bank statement CSV.
 * Supports two header layouts: (date, description, debit, credit) OR (date, description, amount).
 * Dates: dd/MM/yyyy or yyyy-MM-dd. Blank / unparseable data rows are skipped and counted, they
 * never fail the whole import.
 */
@Slf4j
public class BankStatementParser {

    private static final DateTimeFormatter DMY = DateTimeFormatter.ofPattern("d/M/yyyy");
    private static final DateTimeFormatter YMD = DateTimeFormatter.ofPattern("yyyy-M-d");

    public record ParsedRow(LocalDate txnDate, String description, BigDecimal amount, String reference) {
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
            if (isValidHeader(candidate)) {
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

        if (columns == null || !columns.containsKey("date") || !columns.containsKey("description")
                || (!columns.containsKey("amount") && !(columns.containsKey("debit") && columns.containsKey("credit")))) {
            throw new IllegalArgumentException(
                    "Could not detect statement columns - expected a header row with date, description, "
                            + "and either amount, or debit and credit");
        }

        for (int i = headerLineIndex + 1; i < lines.size(); i++) {
            String line = lines.get(i);
            if (line == null || line.isBlank()) {
                continue;
            }

            List<String> fields = splitCsvLine(line);
            ParsedRow row = toRow(fields, columns);
            if (row == null) {
                result.skipped++;
            } else {
                result.rows.add(row);
            }
        }

        return result;
    }

    private ParsedRow toRow(List<String> fields, Map<String, Integer> columns) {
        LocalDate txnDate = parseDate(field(fields, columns.get("date")));
        String description = field(fields, columns.get("description"));
        if (description != null) {
            description = description.trim();
        }

        BigDecimal amount;
        if (columns.containsKey("amount")) {
            amount = parseAmount(field(fields, columns.get("amount")));
        } else {
            BigDecimal debit = parseAmount(field(fields, columns.get("debit")));
            BigDecimal credit = parseAmount(field(fields, columns.get("credit")));
            if (debit == null && credit == null) {
                amount = null;
            } else {
                BigDecimal debitAbs = debit == null ? BigDecimal.ZERO : debit.abs();
                BigDecimal creditAbs = credit == null ? BigDecimal.ZERO : credit.abs();
                amount = creditAbs.subtract(debitAbs);
            }
        }

        String reference = columns.containsKey("reference") ? field(fields, columns.get("reference")) : null;
        if (reference != null) {
            reference = reference.trim();
            if (reference.isEmpty()) {
                reference = null;
            }
        }

        if (txnDate == null || description == null || description.isEmpty() || amount == null) {
            return null;
        }

        return new ParsedRow(txnDate, description, amount, reference);
    }

    private String field(List<String> fields, Integer idx) {
        if (idx == null || idx >= fields.size()) {
            return null;
        }
        return fields.get(idx);
    }

    private Map<String, Integer> mapHeader(List<String> headerFields) {
        Map<String, Integer> idx = new HashMap<>();
        for (int i = 0; i < headerFields.size(); i++) {
            String h = headerFields.get(i).trim().toLowerCase();
            if (h.contains("date")) {
                idx.putIfAbsent("date", i);
            } else if (h.contains("debit")) {
                idx.putIfAbsent("debit", i);
            } else if (h.contains("credit")) {
                idx.putIfAbsent("credit", i);
            } else if (h.contains("amount")) {
                idx.putIfAbsent("amount", i);
            } else if (h.contains("description") || h.contains("narrative") || h.contains("details")
                    || h.contains("particulars")) {
                idx.putIfAbsent("description", i);
            } else if (h.contains("reference") || h.equals("ref")) {
                idx.putIfAbsent("reference", i);
            }
        }
        return idx;
    }

    private boolean isValidHeader(Map<String, Integer> columns) {
        boolean hasDate = columns.containsKey("date");
        boolean hasDescription = columns.containsKey("description");
        boolean hasAmountShape = columns.containsKey("amount")
                || (columns.containsKey("debit") && columns.containsKey("credit"));
        return hasDate && hasDescription && hasAmountShape;
    }

    private LocalDate parseDate(String raw) {
        if (raw == null) {
            return null;
        }
        String v = raw.trim();
        if (v.isEmpty()) {
            return null;
        }
        try {
            return LocalDate.parse(v, YMD);
        } catch (Exception ignored) {
            // try next format
        }
        try {
            return LocalDate.parse(v, DMY);
        } catch (Exception ignored) {
            // fall through
        }
        return null;
    }

    private BigDecimal parseAmount(String raw) {
        if (raw == null) {
            return null;
        }
        String v = raw.trim();
        if (v.isEmpty()) {
            return null;
        }
        boolean negative = false;
        if (v.startsWith("(") && v.endsWith(")")) {
            negative = true;
            v = v.substring(1, v.length() - 1);
        }
        v = v.replace(",", "").replaceAll("[^0-9.\\-]", "");
        if (v.isEmpty() || v.equals("-")) {
            return null;
        }
        try {
            BigDecimal value = new BigDecimal(v);
            return negative ? value.negate() : value;
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
