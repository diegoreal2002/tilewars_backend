import type { Core } from '@strapi/strapi';

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  bootstrap({ strapi }: { strapi: Core.Strapi }) {
    const workerEnabled = String(process.env.ENABLE_CONFLICT_WORKER ?? 'true') === 'true';
    if (!workerEnabled) {
      strapi.log.info('Conflict worker is disabled by env.');
      return;
    }

    const intervalMs = Number(process.env.CONFLICT_RESOLUTION_INTERVAL_MS ?? 10000);
    const safeInterval = Number.isFinite(intervalMs) && intervalMs >= 3000 ? intervalMs : 10000;
    const maintenanceCheckMs = Number(process.env.MAINTENANCE_CHECK_INTERVAL_MS ?? 3600000);
    const safeMaintenanceCheckMs =
      Number.isFinite(maintenanceCheckMs) && maintenanceCheckMs >= 60000
        ? maintenanceCheckMs
        : 3600000;
    let lastMaintenanceCheckAt = 0;

    strapi.log.info(`Conflict worker started with interval ${safeInterval}ms.`);

    setInterval(async () => {
      try {
        const preparedResult = await strapi
          .service('api::tile.tile' as any)
          .processPreparedDefenseTriggers();
        if (preparedResult.scanned > 0) {
          strapi.log.info(
            `Prepared defense worker scanned ${preparedResult.scanned} and processed ${preparedResult.processed}.`
          );
        }

        const result = await strapi
          .service('api::tile.tile' as any)
          .resolveExpiredConflicts();
        if (result.scanned > 0) {
          strapi.log.info(
            `Conflict worker scanned ${result.scanned} and processed ${result.processed}.`
          );
        }

        const now = Date.now();
        if (now - lastMaintenanceCheckAt >= safeMaintenanceCheckMs) {
          lastMaintenanceCheckAt = now;
          const maintenanceResult = await strapi
            .service('api::tile.tile' as any)
            .maybeRunScheduledMaintenance();
          if (!maintenanceResult.skipped) {
            strapi.log.info(
              `Maintenance run (${maintenanceResult.source}) processed ${maintenanceResult.processed_users} users.`
            );
          }
        }
      } catch (error) {
        const safeError = error as Error;
        strapi.log.error(`Conflict worker error: ${safeError.message}`);
      }
    }, safeInterval);
  },
};
