package com.mulaerp.analytics.controller;

import com.mulaerp.analytics.dto.DashboardStatsDTO;
import com.mulaerp.analytics.dto.SalesChartDataDTO;
import com.mulaerp.analytics.service.AnalyticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/analytics")
@RequiredArgsConstructor
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    @GetMapping("/dashboard-stats")
    public ResponseEntity<DashboardStatsDTO> getDashboardStats() {
        return ResponseEntity.ok(analyticsService.getDashboardStats());
    }

    @GetMapping("/sales-chart")
    public ResponseEntity<SalesChartDataDTO> getSalesChartData(
        @RequestParam(defaultValue = "30") int days
    ) {
        return ResponseEntity.ok(analyticsService.getSalesChartData(days));
    }
}
