const controller = {
  async run(ctx: any) {
    const tokenFromEnv = String(process.env.MAINTENANCE_RUN_TOKEN ?? '').trim();
    const tokenFromHeader = String(ctx.request.headers['x-maintenance-token'] ?? '').trim();

    if (tokenFromEnv) {
      if (!tokenFromHeader || tokenFromHeader !== tokenFromEnv) {
        return ctx.unauthorized('Invalid maintenance token');
      }
    } else if (!ctx.state.user?.id) {
      return ctx.unauthorized('Authentication required');
    }

    try {
      const result = await strapi.service('api::tile.tile' as any).runMaintenanceCycle('manual');
      ctx.body = { data: result };
    } catch (error) {
      const safeError = error as Error & { status?: number };
      ctx.status = safeError.status ?? 500;
      ctx.body = { error: { message: safeError.message || 'Unexpected maintenance error' } };
    }
  },
};

export default controller;
