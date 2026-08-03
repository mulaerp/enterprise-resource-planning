package com.mulaerp.oversight.dto;

import java.time.LocalDateTime;

public record StaleRepairJobDto(
        String jobNumber,
        String status,
        LocalDateTime receivedAt,
        long daysOpen,
        String customer
) {
}
