package com.mulaerp.entity;

import com.fasterxml.jackson.annotation.JsonFormat;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public class BillOfMaterials {
    private String id;
    private String productId;
    private String productName;
    private List<BOMComponent> components;
    private BigDecimal totalCost;
    private BigDecimal laborHours;
    private BigDecimal laborCost;
    private BigDecimal overheadCost;
    private BigDecimal finalCost;
    private String status; // active, inactive, draft
    
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime createdAt;
    
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime updatedAt;

    // Constructors
    public BillOfMaterials() {}

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getProductId() { return productId; }
    public void setProductId(String productId) { this.productId = productId; }

    public String getProductName() { return productName; }
    public void setProductName(String productName) { this.productName = productName; }

    public List<BOMComponent> getComponents() { return components; }
    public void setComponents(List<BOMComponent> components) { this.components = components; }

    public BigDecimal getTotalCost() { return totalCost; }
    public void setTotalCost(BigDecimal totalCost) { this.totalCost = totalCost; }

    public BigDecimal getLaborHours() { return laborHours; }
    public void setLaborHours(BigDecimal laborHours) { this.laborHours = laborHours; }

    public BigDecimal getLaborCost() { return laborCost; }
    public void setLaborCost(BigDecimal laborCost) { this.laborCost = laborCost; }

    public BigDecimal getOverheadCost() { return overheadCost; }
    public void setOverheadCost(BigDecimal overheadCost) { this.overheadCost = overheadCost; }

    public BigDecimal getFinalCost() { return finalCost; }
    public void setFinalCost(BigDecimal finalCost) { this.finalCost = finalCost; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public static class BOMComponent {
        private String itemId;
        private String itemName;
        private BigDecimal quantity;
        private String unit;
        private BigDecimal cost;

        // Constructors
        public BOMComponent() {}

        public BOMComponent(String itemId, String itemName, BigDecimal quantity, String unit, BigDecimal cost) {
            this.itemId = itemId;
            this.itemName = itemName;
            this.quantity = quantity;
            this.unit = unit;
            this.cost = cost;
        }

        // Getters and Setters
        public String getItemId() { return itemId; }
        public void setItemId(String itemId) { this.itemId = itemId; }

        public String getItemName() { return itemName; }
        public void setItemName(String itemName) { this.itemName = itemName; }

        public BigDecimal getQuantity() { return quantity; }
        public void setQuantity(BigDecimal quantity) { this.quantity = quantity; }

        public String getUnit() { return unit; }
        public void setUnit(String unit) { this.unit = unit; }

        public BigDecimal getCost() { return cost; }
        public void setCost(BigDecimal cost) { this.cost = cost; }
    }
}