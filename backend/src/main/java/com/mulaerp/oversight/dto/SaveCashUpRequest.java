package com.mulaerp.oversight.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
public class SaveCashUpRequest {

    @NotNull
    private LocalDate date;

    @NotEmpty
    @Valid
    private List<CountEntry> counts;

    @Getter
    @Setter
    @NoArgsConstructor
    public static class CountEntry {

        @NotNull
        private String paymentMethod;

        @NotNull
        private BigDecimal counted;

        private String notes;
    }
}
