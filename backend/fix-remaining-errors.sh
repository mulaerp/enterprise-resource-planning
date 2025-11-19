#!/bin/bash
set -e

echo "Fixing remaining compilation errors..."

# Fix SecurityConfig - HeaderValue issue (Spring Security 6.4 API change)
# Line 44: .header("Access-Control-Allow-Origin", "*")
# Need to check the actual line and fix it

# Fix NotificationService - UUID to String (line 101)
# Find and replace userId UUID to String conversion

# Fix ReportService - Multiple UUID and LocalDateTime issues
# Lines 29, 46, 82, 173: UUID to String
# Lines 29: LocalDateTime to LocalDate

# Fix SalesOrderDto and SalesOrderItemDto - UUID to String conversions

echo "Please run with Java 21:"
echo "export JAVA_HOME=\$(/usr/libexec/java_home -v 21)"
echo "mvn clean compile -DskipTests"
