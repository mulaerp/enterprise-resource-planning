/*
 * Mula ERP - Enterprise Resource Planning System
 * Copyright (c) 2025 Mula Solution & Enterprise
 * 
 * Licensed under the Business Source License 1.1 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 *     https://github.com/mulaerp/enterprise-resource-planning/blob/main/LICENSE
 * 
 * Change Date: 2029-01-19
 * Change License: GNU General Public License v3.0 or later
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package com.mulaerp;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableJpaAuditing
@EnableScheduling
@EnableAsync
public class MulaErpApplication {
    public static void main(String[] args) {
        SpringApplication.run(MulaErpApplication.class, args);
    }
}
