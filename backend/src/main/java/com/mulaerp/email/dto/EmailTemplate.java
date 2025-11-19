package com.mulaerp.email.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EmailTemplate {
    private String to;
    private String subject;
    private String templateName;
    private Map<String, Object> variables;
}
