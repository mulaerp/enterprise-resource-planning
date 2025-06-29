package com.mulaerp;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class MulaErpApplication {
    public static void main(String[] args) {
        SpringApplication.run(MulaErpApplication.class, args);
    }
}