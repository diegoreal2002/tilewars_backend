/**
 * tile controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::tile.tile' as any, ({ strapi }) => ({
  async purchaseFreeTile(ctx: any) {
    const userId = Number(ctx.state.user?.id);
    if (!userId) {
      return ctx.unauthorized('Authentication required');
    }

    const tileId = Number(ctx.params.id);
    if (!Number.isInteger(tileId) || tileId <= 0) {
      return ctx.badRequest('Invalid tile id');
    }

    try {
      const result = await strapi.service('api::tile.tile' as any).purchaseFreeTile(userId, tileId);
      ctx.body = { data: result };
    } catch (error) {
      const safeError = error as Error & { status?: number };
      const status = safeError.status ?? 500;
      const message = safeError.message || 'Unexpected error';
      ctx.status = status;
      ctx.body = { error: { message } };
    }
  },

  async startAttack(ctx: any) {
    const userId = Number(ctx.state.user?.id);
    if (!userId) {
      return ctx.unauthorized('Authentication required');
    }

    const tileId = Number(ctx.params.id);
    const bid = Number(ctx.request.body?.bid);
    if (!Number.isInteger(tileId) || tileId <= 0) {
      return ctx.badRequest('Invalid tile id');
    }
    if (!Number.isInteger(bid) || bid <= 0) {
      return ctx.badRequest('Bid must be a positive integer');
    }

    try {
      const result = await strapi.service('api::tile.tile' as any).startAttack(userId, tileId, bid);
      ctx.body = { data: result };
    } catch (error) {
      const safeError = error as Error & { status?: number };
      const status = safeError.status ?? 500;
      const message = safeError.message || 'Unexpected error';
      ctx.status = status;
      ctx.body = { error: { message } };
    }
  },

  async outbidAttack(ctx: any) {
    const userId = Number(ctx.state.user?.id);
    if (!userId) {
      return ctx.unauthorized('Authentication required');
    }

    const tileId = Number(ctx.params.id);
    const bid = Number(ctx.request.body?.bid);
    if (!Number.isInteger(tileId) || tileId <= 0) {
      return ctx.badRequest('Invalid tile id');
    }
    if (!Number.isInteger(bid) || bid <= 0) {
      return ctx.badRequest('Bid must be a positive integer');
    }

    try {
      const result = await strapi.service('api::tile.tile' as any).outbidAttack(userId, tileId, bid);
      ctx.body = { data: result };
    } catch (error) {
      const safeError = error as Error & { status?: number };
      const status = safeError.status ?? 500;
      const message = safeError.message || 'Unexpected error';
      ctx.status = status;
      ctx.body = { error: { message } };
    }
  },

  async defendTile(ctx: any) {
    const userId = Number(ctx.state.user?.id);
    if (!userId) {
      return ctx.unauthorized('Authentication required');
    }

    const tileId = Number(ctx.params.id);
    const bid = Number(ctx.request.body?.bid);
    if (!Number.isInteger(tileId) || tileId <= 0) {
      return ctx.badRequest('Invalid tile id');
    }
    if (!Number.isInteger(bid) || bid <= 0) {
      return ctx.badRequest('Bid must be a positive integer');
    }

    try {
      const result = await strapi.service('api::tile.tile' as any).defendTile(userId, tileId, bid);
      ctx.body = { data: result };
    } catch (error) {
      const safeError = error as Error & { status?: number };
      const status = safeError.status ?? 500;
      const message = safeError.message || 'Unexpected error';
      ctx.status = status;
      ctx.body = { error: { message } };
    }
  },

  async resolveConflict(ctx: any) {
    const userId = Number(ctx.state.user?.id);
    if (!userId) {
      return ctx.unauthorized('Authentication required');
    }

    const tileId = Number(ctx.params.id);
    if (!Number.isInteger(tileId) || tileId <= 0) {
      return ctx.badRequest('Invalid tile id');
    }

    try {
      const result = await strapi.service('api::tile.tile' as any).resolveTileConflict(tileId, 'manual');
      ctx.body = { data: result };
    } catch (error) {
      const safeError = error as Error & { status?: number };
      const status = safeError.status ?? 500;
      const message = safeError.message || 'Unexpected error';
      ctx.status = status;
      ctx.body = { error: { message } };
    }
  },

  async configurePreparedDefense(ctx: any) {
    const userId = Number(ctx.state.user?.id);
    if (!userId) {
      return ctx.unauthorized('Authentication required');
    }

    const tileId = Number(ctx.params.id);
    const type = String(ctx.request.body?.type ?? '');
    const cushion = Number(ctx.request.body?.cushion);
    if (!Number.isInteger(tileId) || tileId <= 0) {
      return ctx.badRequest('Invalid tile id');
    }
    if (!['instant', 'm10', 'h1', 'h12'].includes(type)) {
      return ctx.badRequest('Invalid prepared defense type');
    }
    if (!Number.isInteger(cushion) || cushion <= 0) {
      return ctx.badRequest('Cushion must be a positive integer');
    }

    try {
      const result = await strapi
        .service('api::tile.tile' as any)
        .configurePreparedDefense(userId, tileId, type, cushion);
      ctx.body = { data: result };
    } catch (error) {
      const safeError = error as Error & { status?: number };
      const status = safeError.status ?? 500;
      const message = safeError.message || 'Unexpected error';
      ctx.status = status;
      ctx.body = { error: { message } };
    }
  },

  async buyShield(ctx: any) {
    const userId = Number(ctx.state.user?.id);
    if (!userId) {
      return ctx.unauthorized('Authentication required');
    }

    const tileId = Number(ctx.params.id);
    const hours = Number(ctx.request.body?.hours);
    if (!Number.isInteger(tileId) || tileId <= 0) {
      return ctx.badRequest('Invalid tile id');
    }
    if (!Number.isInteger(hours) || hours < 1 || hours > 168) {
      return ctx.badRequest('Hours must be an integer between 1 and 168');
    }

    try {
      const result = await strapi.service('api::tile.tile' as any).buyShield(userId, tileId, hours);
      ctx.body = { data: result };
    } catch (error) {
      const safeError = error as Error & { status?: number };
      const status = safeError.status ?? 500;
      const message = safeError.message || 'Unexpected error';
      ctx.status = status;
      ctx.body = { error: { message } };
    }
  },
}));
