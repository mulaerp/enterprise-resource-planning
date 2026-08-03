package com.mulaerp.repair.dto;

import com.mulaerp.repair.entity.RepairPayment;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RepairPaymentDto {
    private UUID id;
    private UUID repairJobId;
    private RepairPayment.AmountType amountType;
    private BigDecimal amount;
    private String paymentMethod;
    private LocalDateTime paidAt;

    /** V37: true for a refund row - see RepairPayment class javadoc. */
    private Boolean isRefund;
    private UUID originalPaymentId;
    private String refundReason;
    private String refundedBy;

    public static RepairPaymentDto fromEntity(RepairPayment payment) {
        RepairPaymentDto dto = new RepairPaymentDto();
        dto.setId(payment.getId());
        dto.setRepairJobId(payment.getRepairJobId());
        dto.setAmountType(payment.getAmountType());
        dto.setAmount(payment.getAmount());
        dto.setPaymentMethod(payment.getPaymentMethod());
        dto.setPaidAt(payment.getPaidAt());
        dto.setIsRefund(Boolean.TRUE.equals(payment.getIsRefund()));
        dto.setOriginalPaymentId(payment.getOriginalPaymentId());
        dto.setRefundReason(payment.getRefundReason());
        dto.setRefundedBy(payment.getRefundedBy());
        return dto;
    }
}
