package com.mulaerp.audit.listener;

import com.mulaerp.audit.entity.AuditLog;
import com.mulaerp.audit.service.AuditLogWriter;
import com.mulaerp.common.entity.BaseEntity;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.hibernate.event.spi.PostDeleteEvent;
import org.hibernate.event.spi.PostDeleteEventListener;
import org.hibernate.event.spi.PostInsertEvent;
import org.hibernate.event.spi.PostInsertEventListener;
import org.hibernate.event.spi.PostUpdateEvent;
import org.hibernate.event.spi.PostUpdateEventListener;
import org.hibernate.persister.entity.EntityPersister;
import org.hibernate.type.Type;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/**
 * Site-wide automatic audit trail (WP5).
 *
 * <p>This is registered directly against Hibernate's {@code EventListenerRegistry} (see {@link
 * AuditHibernateListenerRegistrar}) rather than declared as a JPA {@code @EntityListeners} class
 * on {@code BaseEntity}, for two concrete reasons found while building this:
 *
 * <ol>
 *   <li><b>The classic "Spring bean inside a JPA listener" pitfall.</b> When Hibernate itself
 *       instantiates an {@code @EntityListeners} class, whether {@code @Autowired} fields resolve
 *       depends on {@code hibernate.resource.beanContainer} wiring that isn't something this
 *       codebase configures explicitly, and is not something worth depending on implicitly.
 *       Registering the listener instance ourselves - constructed by the plain Spring
 *       {@code @Component} in {@link AuditHibernateListenerRegistrar} - sidesteps the problem
 *       entirely: {@link AuditLogWriter} is passed through an ordinary constructor, no bean
 *       container resolution required.</li>
 *   <li><b>JPA's {@code @PreUpdate}/{@code @PostUpdate} callbacks only ever see the CURRENT
 *       (already-mutated) in-memory entity</b> - there is no portable way to read pre-update DB
 *       values from them. Hibernate's native {@link PostUpdateEvent}, by contrast, exposes
 *       {@code getOldState()}/{@code getState()} arrays straight from its own dirty-checking
 *       machinery, which is what makes the required "field: old -&gt; new" changed-field summary
 *       possible without a hand-rolled (and leak-prone) snapshot cache.</li>
 * </ol>
 *
 * <p><b>Why the actual write is deferred to {@code afterCompletion()}, not done inline:</b> two
 * runtime failures shaped this, in order:
 * <ol>
 *   <li>The first working version called {@code AuditLogWriter.write(...)} - i.e. a normal
 *       {@code repository.save()} - directly from {@code onPostInsert}/{@code onPostUpdate}/
 *       {@code onPostDelete}. That blew up with {@code ConcurrentModificationException} inside
 *       Hibernate's {@code ActionQueue.executeActions()}: those Post* events fire WHILE
 *       Hibernate is iterating its action queue to execute the pending statements for the
 *       current flush, and {@code save()} on a brand-new AuditLog entity adds a new action to
 *       that same queue mid-iteration.</li>
 *   <li>The next attempt only enqueued a lightweight {@link PendingAuditEntry} during the Post*
 *       callback, then registered a {@link TransactionSynchronization} whose {@code
 *       beforeCommit()} did the actual {@code save()} calls. That also produced zero audit
 *       rows, silently: for this app's typical {@code findById() -> mutate -> save()} pattern,
 *       Hibernate doesn't flush the entity until {@code JpaTransactionManager.doCommit()} calls
 *       {@code entityManager.getTransaction().commit()} - which is AFTER Spring has already
 *       invoked {@code triggerBeforeCommit()} on whatever synchronizations existed at that
 *       point. Registering ours from inside that same commit-triggered flush was too late for
 *       {@code beforeCommit()} to ever be called on it.</li>
 * </ol>
 * The fix that actually works: still only enqueue in-memory during the Post* callback (no
 * Hibernate/session interaction at all, so no concurrent-modification risk), but perform the
 * real writes in {@code afterCompletion(status)}, gated on {@code STATUS_COMMITTED} - that
 * callback is guaranteed to run once the whole commit (or rollback) has finished, regardless of
 * when the synchronization was registered. {@link AuditLogWriter#write} runs in its own {@code
 * REQUIRES_NEW} transaction there, since the original transaction/session is already closed by
 * that point. Net effect: a rolled-back business transaction never produces an audit row
 * (STATUS_COMMITTED never fires), and a committed one always does - the requirement's intent
 * ("rollback = no audit row") holds, even though the write itself is a separate physical
 * transaction rather than literally the same one.
 *
 * <p>Verified at runtime against the live stack (see WP5 verification): CREATE/UPDATE/soft-DELETE
 * on a Product produced the expected rows with the authenticated username and a changed-field
 * summary, queryable via {@code GET /api/v1/audit-logs}.
 */
@Slf4j
@RequiredArgsConstructor
public class AuditPersistenceEventListener
        implements PostInsertEventListener, PostUpdateEventListener, PostDeleteEventListener {

    private static final int MAX_SUMMARY_LENGTH = 2000;
    private static final int MAX_VALUE_LENGTH = 200;
    private static final Set<String> IGNORED_PROPERTIES = Set.of("createdAt", "updatedAt", "createdBy", "updatedBy");

    private final AuditLogWriter auditLogWriter;

    @Override
    public void onPostInsert(PostInsertEvent event) {
        BaseEntity entity = auditable(event.getEntity());
        if (entity == null) {
            return;
        }
        safeWrite(entity, (UUID) event.getId(), "CREATE", null);
    }

    @Override
    public void onPostUpdate(PostUpdateEvent event) {
        BaseEntity entity = auditable(event.getEntity());
        if (entity == null) {
            return;
        }

        String[] propertyNames = event.getPersister().getPropertyNames();
        Object[] oldState = event.getOldState();
        Object[] newState = event.getState();

        boolean softDeleted = isSoftDelete(propertyNames, oldState, newState);
        String summary = diff(propertyNames, oldState, newState, event.getPersister());

        safeWrite(entity, (UUID) event.getId(), softDeleted ? "DELETE" : "UPDATE", summary);
    }

    @Override
    public void onPostDelete(PostDeleteEvent event) {
        BaseEntity entity = auditable(event.getEntity());
        if (entity == null) {
            return;
        }
        safeWrite(entity, (UUID) event.getId(), "DELETE", null);
    }

    // We only need Hibernate to call onPost* once, synchronously with the flush that produces
    // the entity's own SQL - "post-commit" here is handled by us, via the afterCompletion
    // TransactionSynchronization registered in queuePendingWrite(), not by Hibernate re-invoking
    // this listener after commit.
    @Override
    public boolean requiresPostCommitHandling(EntityPersister persister) {
        return false;
    }

    private BaseEntity auditable(Object entity) {
        // Hard-exclude the audit entity itself so writing an audit row can never itself be
        // audited (infinite recursion). AuditLog doesn't extend BaseEntity, so this check is
        // belt-and-braces on top of the structural exclusion.
        if (entity == null || entity instanceof AuditLog) {
            return null;
        }
        return entity instanceof BaseEntity be ? be : null;
    }

    private static final String PENDING_ENTRIES_RESOURCE_KEY =
            AuditPersistenceEventListener.class.getName() + ".pendingEntries";

    private void safeWrite(BaseEntity entity, UUID id, String action, String changeSummary) {
        try {
            queuePendingWrite(entity.getClass().getSimpleName(), id, action, changeSummary);
        } catch (Exception e) {
            log.warn("Skipped audit log entry for {} {}: {}", action, entity.getClass().getSimpleName(), e.getMessage());
        }
    }

    /**
     * Buffers the write for this in-flight transaction and, on the first entry for a given
     * transaction, registers the {@link TransactionSynchronization} that actually persists the
     * buffered rows in {@code afterCompletion()} (only when the transaction committed). See the
     * class javadoc for why this indirection exists, and why {@code afterCompletion} rather than
     * {@code beforeCommit}. Falls back to writing immediately when there's no Spring transaction
     * to hook into (nothing else could be mutating a Hibernate action queue in that case).
     */
    @SuppressWarnings("unchecked")
    private void queuePendingWrite(String entityType, UUID id, String action, String changeSummary) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            auditLogWriter.write(entityType, id, action, changeSummary);
            return;
        }

        List<PendingAuditEntry> pending =
                (List<PendingAuditEntry>) TransactionSynchronizationManager.getResource(PENDING_ENTRIES_RESOURCE_KEY);
        if (pending == null) {
            pending = new ArrayList<>();
            TransactionSynchronizationManager.bindResource(PENDING_ENTRIES_RESOURCE_KEY, pending);

            List<PendingAuditEntry> entries = pending;
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCompletion(int status) {
                    // STATUS_COMMITTED only - a rolled-back business transaction must not produce
                    // an audit row. AuditLogWriter.write() runs in its own REQUIRES_NEW
                    // transaction (the original one is already closed by this point), so this
                    // does not touch the now-finished Hibernate session/action queue at all.
                    if (status == TransactionSynchronization.STATUS_COMMITTED) {
                        for (PendingAuditEntry entry : entries) {
                            try {
                                auditLogWriter.write(entry.entityType(), entry.id(), entry.action(), entry.changeSummary());
                            } catch (Exception e) {
                                log.warn("Skipped audit log entry for {} {}: {}", entry.action(), entry.entityType(), e.getMessage());
                            }
                        }
                    }
                    if (TransactionSynchronizationManager.hasResource(PENDING_ENTRIES_RESOURCE_KEY)) {
                        TransactionSynchronizationManager.unbindResource(PENDING_ENTRIES_RESOURCE_KEY);
                    }
                }
            });
        }
        pending.add(new PendingAuditEntry(entityType, id, action, changeSummary));
    }

    private record PendingAuditEntry(String entityType, UUID id, String action, String changeSummary) {
    }

    private boolean isSoftDelete(String[] propertyNames, Object[] oldState, Object[] newState) {
        if (oldState == null || newState == null) {
            return false;
        }
        for (int i = 0; i < propertyNames.length; i++) {
            if ("deleted".equals(propertyNames[i])) {
                return !Boolean.TRUE.equals(oldState[i]) && Boolean.TRUE.equals(newState[i]);
            }
        }
        return false;
    }

    private String diff(String[] propertyNames, Object[] oldState, Object[] newState, EntityPersister persister) {
        if (newState == null) {
            return null;
        }
        Type[] propertyTypes = persister.getPropertyTypes();
        StringBuilder sb = new StringBuilder();

        for (int i = 0; i < propertyNames.length; i++) {
            String name = propertyNames[i];
            if (IGNORED_PROPERTIES.contains(name)) {
                continue;
            }

            // Skip collections and entity associations entirely - only "simple" scalar fields
            // are summarised, per WP5 spec ("skip collections/lob").
            Type type = propertyTypes[i];
            if (type.isCollectionType() || type.isEntityType() || type.isAssociationType()) {
                continue;
            }

            Object oldV = oldState != null ? oldState[i] : null;
            Object newV = newState[i];

            // Treat long text fields (notes/description/address/etc, mapped TEXT/@Lob columns)
            // as skip-worthy too, rather than letting them bloat the summary.
            if (isLongText(oldV) || isLongText(newV)) {
                continue;
            }

            if (Objects.equals(oldV, newV)) {
                continue;
            }

            if (sb.length() > 0) {
                sb.append(", ");
            }
            sb.append(name).append(": ").append(fmt(oldV)).append(" -> ").append(fmt(newV));

            if (sb.length() >= MAX_SUMMARY_LENGTH) {
                sb.setLength(MAX_SUMMARY_LENGTH);
                sb.append("...(truncated)");
                break;
            }
        }
        return sb.length() == 0 ? null : sb.toString();
    }

    private boolean isLongText(Object value) {
        return value instanceof String s && s.length() > MAX_VALUE_LENGTH;
    }

    private String fmt(Object value) {
        return value == null ? "null" : String.valueOf(value);
    }
}
