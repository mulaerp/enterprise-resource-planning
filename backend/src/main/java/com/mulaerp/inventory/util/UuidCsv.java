package com.mulaerp.inventory.util;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Small helper for storing a list of UUIDs as a comma-separated TEXT column (used by
 * sales_order_items.serial_ids / purchase_order_items.serial_ids - WP3 batch/serial linking).
 * Avoids a join table for what is, per line item, a short list of serial numbers.
 */
public final class UuidCsv {

    private UuidCsv() {
    }

    /** Returns a comma-separated string, or null if the list is null/empty (keeps the column NULL). */
    public static String toCsv(List<UUID> ids) {
        if (ids == null || ids.isEmpty()) {
            return null;
        }
        return ids.stream().map(UUID::toString).collect(Collectors.joining(","));
    }

    /** Returns the parsed list, or an empty (mutable) list if the input is null/blank. */
    public static List<UUID> fromCsv(String csv) {
        if (csv == null || csv.isBlank()) {
            return Collections.emptyList();
        }
        List<UUID> result = new ArrayList<>();
        for (String part : csv.split(",")) {
            if (!part.isBlank()) {
                result.add(UUID.fromString(part.trim()));
            }
        }
        return result;
    }
}
