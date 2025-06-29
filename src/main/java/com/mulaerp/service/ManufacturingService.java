package com.mulaerp.service;

import com.mulaerp.entity.BillOfMaterials;
import com.mulaerp.entity.WorkOrder;
import com.mulaerp.repository.BOMRepository;
import com.mulaerp.repository.WorkOrderRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class ManufacturingService {

    @Autowired
    private BOMRepository bomRepository;

    @Autowired
    private WorkOrderRepository workOrderRepository;

    // BOM Operations
    @Cacheable(value = "boms", key = "'all'")
    public List<BillOfMaterials> getAllBOMs() {
        return bomRepository.findAll();
    }

    @Cacheable(value = "boms", key = "#id")
    public Optional<BillOfMaterials> getBOMById(String id) {
        return bomRepository.findById(id);
    }

    @CacheEvict(value = "boms", allEntries = true)
    public BillOfMaterials createBOM(BillOfMaterials bom) {
        bom.setId(generateBOMId());
        bom.setCreatedAt(LocalDateTime.now());
        bom.setUpdatedAt(LocalDateTime.now());
        bom.setStatus("active");
        return bomRepository.save(bom);
    }

    @CacheEvict(value = "boms", allEntries = true)
    public BillOfMaterials updateBOM(String id, BillOfMaterials bom) {
        bom.setId(id);
        bom.setUpdatedAt(LocalDateTime.now());
        return bomRepository.save(bom);
    }

    @CacheEvict(value = "boms", allEntries = true)
    public void deleteBOM(String id) {
        bomRepository.deleteById(id);
    }

    // Work Order Operations
    @Cacheable(value = "workorders", key = "'all'")
    public List<WorkOrder> getAllWorkOrders() {
        return workOrderRepository.findAll();
    }

    @Cacheable(value = "workorders", key = "#id")
    public Optional<WorkOrder> getWorkOrderById(String id) {
        return workOrderRepository.findById(id);
    }

    @CacheEvict(value = "workorders", allEntries = true)
    public WorkOrder createWorkOrder(WorkOrder workOrder) {
        workOrder.setId(generateWorkOrderId());
        workOrder.setCreatedAt(LocalDateTime.now());
        workOrder.setUpdatedAt(LocalDateTime.now());
        workOrder.setStatus("draft");
        workOrder.setProgress(0);
        return workOrderRepository.save(workOrder);
    }

    @CacheEvict(value = "workorders", allEntries = true)
    public WorkOrder updateWorkOrder(String id, WorkOrder workOrder) {
        workOrder.setId(id);
        workOrder.setUpdatedAt(LocalDateTime.now());
        return workOrderRepository.save(workOrder);
    }

    @CacheEvict(value = "workorders", allEntries = true)
    public WorkOrder updateWorkOrderStatus(String id, String status) {
        Optional<WorkOrder> workOrderOpt = workOrderRepository.findById(id);
        if (workOrderOpt.isPresent()) {
            WorkOrder workOrder = workOrderOpt.get();
            workOrder.setStatus(status);
            workOrder.setUpdatedAt(LocalDateTime.now());
            
            // Update progress based on status
            switch (status) {
                case "in-progress":
                    if (workOrder.getProgress() == 0) {
                        workOrder.setProgress(10);
                    }
                    break;
                case "completed":
                    workOrder.setProgress(100);
                    workOrder.setActualEndDate(LocalDateTime.now().toLocalDate());
                    break;
                case "cancelled":
                    // Keep current progress
                    break;
            }
            
            return workOrderRepository.save(workOrder);
        }
        throw new RuntimeException("Work order not found: " + id);
    }

    @CacheEvict(value = "workorders", allEntries = true)
    public void deleteWorkOrder(String id) {
        workOrderRepository.deleteById(id);
    }

    public List<WorkOrder> getWorkOrdersByStatus(String status) {
        return workOrderRepository.findByStatus(status);
    }

    public List<WorkOrder> getWorkOrdersByAssignee(String assignedTo) {
        return workOrderRepository.findByAssignedTo(assignedTo);
    }

    private String generateBOMId() {
        return "BOM" + System.currentTimeMillis();
    }

    private String generateWorkOrderId() {
        return "WO" + System.currentTimeMillis();
    }
}