package com.mulaerp.audit.listener;

import com.mulaerp.audit.service.AuditLogWriter;
import jakarta.annotation.PostConstruct;
import jakarta.persistence.EntityManagerFactory;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.hibernate.engine.spi.SessionFactoryImplementor;
import org.hibernate.event.service.spi.EventListenerRegistry;
import org.hibernate.event.spi.EventType;
import org.springframework.stereotype.Component;

/**
 * Wires {@link AuditPersistenceEventListener} into Hibernate's event pipeline at startup so
 * every entity that extends {@code BaseEntity} gets INSERT/UPDATE/soft-DELETE audit coverage
 * automatically, without each module having to add anything itself. See {@link
 * AuditPersistenceEventListener} for why this goes through the native EventListenerRegistry
 * rather than a JPA {@code @EntityListeners} class.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AuditHibernateListenerRegistrar {

    private final EntityManagerFactory entityManagerFactory;
    private final AuditLogWriter auditLogWriter;

    @PostConstruct
    public void registerAuditListeners() {
        SessionFactoryImplementor sessionFactory = entityManagerFactory.unwrap(SessionFactoryImplementor.class);
        EventListenerRegistry registry = sessionFactory.getServiceRegistry().getService(EventListenerRegistry.class);

        AuditPersistenceEventListener listener = new AuditPersistenceEventListener(auditLogWriter);
        registry.appendListeners(EventType.POST_INSERT, listener);
        registry.appendListeners(EventType.POST_UPDATE, listener);
        registry.appendListeners(EventType.POST_DELETE, listener);

        log.info("Registered site-wide audit trail Hibernate event listeners (POST_INSERT/POST_UPDATE/POST_DELETE)");
    }
}
