#!/bin/bash

# Fix UserService.java - convert enum to string
sed -i '' 's/dto.setRole(user.getRole());/dto.setRole(user.getRole().name());/g' src/main/java/com/mulaerp/auth/service/UserService.java
sed -i '' 's/dto.setStatus(user.getStatus());/dto.setStatus(user.getStatus().name());/g' src/main/java/com/mulaerp/auth/service/UserService.java

# Fix NotificationService.java - convert UUID to String
sed -i '' 's/notification.setUserId(userId);/notification.setUserId(userId.toString());/g' src/main/java/com/mulaerp/notifications/service/NotificationService.java

# Fix SalesOrderDto.java - convert UUID to String
sed -i '' 's/dto.setCustomerId(order.getCustomer().getId());/dto.setCustomerId(order.getCustomer().getId().toString());/g' src/main/java/com/mulaerp/sales/dto/SalesOrderDto.java
sed -i '' 's/dto.setCustomerName(order.getCustomer() != null ? order.getCustomer().getId() : null);/dto.setCustomerName(order.getCustomer() != null ? order.getCustomer().getName() : null);/g' src/main/java/com/mulaerp/sales/dto/SalesOrderDto.java

# Fix SalesOrderItemDto.java - convert UUID to String  
sed -i '' 's/itemDto.setProductId(item.getProduct().getId());/itemDto.setProductId(item.getProduct().getId().toString());/g' src/main/java/com/mulaerp/sales/dto/SalesOrderItemDto.java
sed -i '' 's/itemDto.setProductName(item.getProduct() != null ? item.getProduct().getId() : null);/itemDto.setProductName(item.getProduct() != null ? item.getProduct().getName() : null);/g' src/main/java/com/mulaerp/sales/dto/SalesOrderItemDto.java

echo "Compilation fixes applied"
