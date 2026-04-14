/**
 * tile service
 */

import { factories } from '@strapi/strapi';

const createHttpError = (status: number, message: string) => {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
};

const parsePositiveInt = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.ceil(parsed);
};

const isFutureDate = (value: unknown) => {
  if (!value) return false;
  const date = new Date(String(value));
  return !Number.isNaN(date.getTime()) && date.getTime() > Date.now();
};

const isPastOrNowDate = (value: unknown) => {
  if (!value) return false;
  const date = new Date(String(value));
  return !Number.isNaN(date.getTime()) && date.getTime() <= Date.now();
};

const preparedDefenseDelaySecondsByType: Record<string, number> = {
  instant: 0,
  m10: 10 * 60,
  h1: 60 * 60,
  h12: 12 * 60 * 60,
};

export default factories.createCoreService('api::tile.tile' as any, ({ strapi }) => ({
  async getProfileByUserId(userId: number) {
    const profile = await strapi.db.query('api::usua.usua' as any).findOne({
      where: { user: userId },
    });
    if (!profile) {
      throw createHttpError(404, 'Player profile not found');
    }
    return profile;
  },

  async createCoinLedgerEntry(data: Record<string, unknown>) {
    await strapi.db.query('api::coin-ledger.coin-ledger' as any).create({ data });
  },

  getPreparedDefensePercentByType(settings: any, type: string) {
    if (type === 'instant') return Number(settings?.prepared_defense_instant_pct ?? 0.5);
    if (type === 'm10') return Number(settings?.prepared_defense_10m_pct ?? 0.2);
    if (type === 'h1') return Number(settings?.prepared_defense_1h_pct ?? 0.02);
    return Number(settings?.prepared_defense_12h_pct ?? 0);
  },

  async purchaseFreeTile(userId: number, tileId: number) {
    const tile = await strapi.db.query('api::tile.tile' as any).findOne({
      where: { id: tileId },
      populate: { tile_owner: true },
    });

    if (!tile) {
      throw createHttpError(404, 'Tile not found');
    }

    if (tile.tile_owner) {
      throw createHttpError(409, 'Tile is already owned');
    }

    const settings = await strapi.db.query('api::game-setting.game-setting' as any).findOne({
      orderBy: { id: 'desc' },
    });
    const baseTilePrice = parsePositiveInt(settings?.base_tile_price, 10);

    const profile = await this.getProfileByUserId(userId);

    const currentBalance = parsePositiveInt(profile.usua_nocoin, 0);
    if (currentBalance < baseTilePrice) {
      throw createHttpError(400, 'Insufficient coin balance');
    }

    const balanceAfter = currentBalance - baseTilePrice;
    const now = new Date().toISOString();

    await strapi.db.query('api::usua.usua' as any).update({
      where: { id: profile.id },
      data: { usua_nocoin: balanceAfter },
    });

    const updatedTile = await strapi.db.query('api::tile.tile' as any).update({
      where: { id: tileId },
      data: {
        tile_owner: userId,
        tile_real_price: baseTilePrice,
        tile_streak_start_at: now,
        tile_uattac: false,
        tile_attack_ends_at: null,
      },
      populate: { tile_owner: true },
    });

    await this.createCoinLedgerEntry({
      entry_type: 'tile_buy',
      amount: -baseTilePrice,
      balance_after: balanceAfter,
      reason: 'Initial purchase of free tile',
      metadata: {
        tile_id: tileId,
        source: 'api.tiles.buy-free',
      },
      user: userId,
      profile: profile.id,
      tile: tileId,
    });

    return {
      tile: updatedTile,
      balance: balanceAfter,
      charged: baseTilePrice,
    };
  },

  async startAttack(userId: number, tileId: number, bid: number) {
    const tile = await strapi.db.query('api::tile.tile' as any).findOne({
      where: { id: tileId },
      populate: { tile_owner: true, tile_attack_max_bidder: true },
    });
    if (!tile) {
      throw createHttpError(404, 'Tile not found');
    }
    if (!tile.tile_owner) {
      throw createHttpError(400, 'Cannot attack a free tile');
    }
    if (Number(tile.tile_owner.id) === userId) {
      throw createHttpError(400, 'Cannot attack your own tile');
    }
    if (isFutureDate(tile.tile_shield_ends_at)) {
      throw createHttpError(409, 'Tile shield is active');
    }
    if (tile.tile_uattac && isFutureDate(tile.tile_attack_ends_at)) {
      throw createHttpError(409, 'Tile is already under active attack');
    }

    const settings = await strapi.db.query('api::game-setting.game-setting' as any).findOne({
      orderBy: { id: 'desc' },
    });
    const attackHours = parsePositiveInt(settings?.attack_window_hours, 24);
    const minBid = parsePositiveInt(tile.tile_real_price, 10) + 1;
    if (bid < minBid) {
      throw createHttpError(400, `Bid must be >= ${minBid}`);
    }

    const profile = await this.getProfileByUserId(userId);
    const currentBalance = parsePositiveInt(profile.usua_nocoin, 0);
    if (currentBalance < bid) {
      throw createHttpError(400, 'Insufficient coin balance');
    }

    const balanceAfter = currentBalance - bid;
    const now = new Date();
    const endsAt = new Date(now.getTime() + attackHours * 60 * 60 * 1000);
    const preparedDefenseDelay =
      preparedDefenseDelaySecondsByType[String(tile.tile_prepared_defense_type ?? '')] ?? null;
    const preparedDefenseTriggerAt =
      tile.tile_prepared_defense_active && preparedDefenseDelay !== null
        ? new Date(now.getTime() + preparedDefenseDelay * 1000).toISOString()
        : null;

    await strapi.db.query('api::usua.usua' as any).update({
      where: { id: profile.id },
      data: { usua_nocoin: balanceAfter },
    });

    const updatedTile = await strapi.db.query('api::tile.tile' as any).update({
      where: { id: tileId },
      data: {
        tile_uattac: true,
        tile_attack_started_at: now.toISOString(),
        tile_attack_ends_at: endsAt.toISOString(),
        tile_attack_max_bid: bid,
        tile_attack_max_bidder: userId,
        tile_defense_max_bid: 0,
        tile_prepared_defense_trigger_at: preparedDefenseTriggerAt,
      },
      populate: { tile_owner: true, tile_attack_max_bidder: true },
    });

    await strapi.db.query('api::attack-bid.attack-bid' as any).create({
      data: {
        amount: bid,
        status: 'active_max',
        placed_at: now.toISOString(),
        tile: tileId,
        user: userId,
        profile: profile.id,
      },
    });

    await this.createCoinLedgerEntry({
      entry_type: 'attack_bid',
      amount: -bid,
      balance_after: balanceAfter,
      reason: 'Initial attack bid',
      metadata: { tile_id: tileId, source: 'api.tiles.attack' },
      user: userId,
      profile: profile.id,
      tile: tileId,
    });

    return {
      tile: updatedTile,
      balance: balanceAfter,
      bid,
      ends_at: endsAt.toISOString(),
    };
  },

  async outbidAttack(userId: number, tileId: number, bid: number) {
    const tile = await strapi.db.query('api::tile.tile' as any).findOne({
      where: { id: tileId },
      populate: { tile_owner: true, tile_attack_max_bidder: true },
    });
    if (!tile) {
      throw createHttpError(404, 'Tile not found');
    }
    if (!tile.tile_uattac || !isFutureDate(tile.tile_attack_ends_at)) {
      throw createHttpError(409, 'Tile is not in active attack phase');
    }
    if (Number(tile.tile_owner?.id) === userId) {
      throw createHttpError(400, 'Tile owner must use defend endpoint');
    }
    const currentMaxBid = parsePositiveInt(tile.tile_attack_max_bid, 0);
    if (bid <= currentMaxBid) {
      throw createHttpError(400, `Bid must be greater than current max (${currentMaxBid})`);
    }
    const currentMaxBidderId = Number(tile.tile_attack_max_bidder?.id);
    if (!currentMaxBidderId) {
      throw createHttpError(500, 'Corrupted attack state: missing max bidder');
    }
    if (currentMaxBidderId === userId) {
      throw createHttpError(400, 'You are already the highest bidder');
    }

    const bidderProfile = await this.getProfileByUserId(userId);
    const bidderBalance = parsePositiveInt(bidderProfile.usua_nocoin, 0);
    if (bidderBalance < bid) {
      throw createHttpError(400, 'Insufficient coin balance');
    }
    const bidderBalanceAfter = bidderBalance - bid;
    await strapi.db.query('api::usua.usua' as any).update({
      where: { id: bidderProfile.id },
      data: { usua_nocoin: bidderBalanceAfter },
    });

    const previousProfile = await this.getProfileByUserId(currentMaxBidderId);
    const previousBalance = parsePositiveInt(previousProfile.usua_nocoin, 0);
    const burned = Math.ceil(currentMaxBid * 0.5);
    const refund = currentMaxBid - burned;
    const previousBalanceAfter = previousBalance + refund;

    await strapi.db.query('api::usua.usua' as any).update({
      where: { id: previousProfile.id },
      data: { usua_nocoin: previousBalanceAfter },
    });

    await strapi.db.query('api::attack-bid.attack-bid' as any).updateMany({
      where: { tile: tileId, user: currentMaxBidderId, status: 'active_max' },
      data: { status: 'overbid' },
    });
    await strapi.db.query('api::attack-bid.attack-bid' as any).create({
      data: {
        amount: bid,
        status: 'active_max',
        placed_at: new Date().toISOString(),
        tile: tileId,
        user: userId,
        profile: bidderProfile.id,
      },
    });

    const updatedTile = await strapi.db.query('api::tile.tile' as any).update({
      where: { id: tileId },
      data: {
        tile_attack_max_bid: bid,
        tile_attack_max_bidder: userId,
      },
      populate: { tile_owner: true, tile_attack_max_bidder: true },
    });

    await this.createCoinLedgerEntry({
      entry_type: 'attack_bid',
      amount: -bid,
      balance_after: bidderBalanceAfter,
      reason: 'Outbid attack bid',
      metadata: {
        tile_id: tileId,
        source: 'api.tiles.outbid',
        previous_max_bid: currentMaxBid,
      },
      user: userId,
      profile: bidderProfile.id,
      tile: tileId,
    });

    await this.createCoinLedgerEntry({
      entry_type: 'refund',
      amount: refund,
      balance_after: previousBalanceAfter,
      reason: 'Refund after being overbid',
      metadata: {
        tile_id: tileId,
        source: 'api.tiles.outbid',
        overbid_by_user_id: userId,
        burned_amount: burned,
      },
      user: currentMaxBidderId,
      profile: previousProfile.id,
      tile: tileId,
    });

    await strapi.db.query('api::burn-log.burn-log' as any).create({
      data: {
        amount: burned,
        reason: 'Burned after attacker was overbid',
        metadata: {
          tile_id: tileId,
          previous_max_bid: currentMaxBid,
          overbid_by_user_id: userId,
        },
        user: currentMaxBidderId,
        profile: previousProfile.id,
        tile: tileId,
      },
    });

    return {
      tile: updatedTile,
      bidder_balance: bidderBalanceAfter,
      previous_bidder_refund: refund,
      burned_amount: burned,
    };
  },

  async defendTile(userId: number, tileId: number, bid: number) {
    const tile = await strapi.db.query('api::tile.tile' as any).findOne({
      where: { id: tileId },
      populate: { tile_owner: true, tile_attack_max_bidder: true },
    });
    if (!tile) {
      throw createHttpError(404, 'Tile not found');
    }
    if (!tile.tile_owner || Number(tile.tile_owner.id) !== userId) {
      throw createHttpError(403, 'Only the tile owner can defend');
    }
    if (!tile.tile_uattac || !isFutureDate(tile.tile_attack_ends_at)) {
      throw createHttpError(409, 'Tile is not in active attack phase');
    }

    const currentAttackMax = parsePositiveInt(tile.tile_attack_max_bid, 0);
    const currentDefenseMax = parsePositiveInt(tile.tile_defense_max_bid, 0);
    const minDefenseBid = Math.max(currentAttackMax + 1, currentDefenseMax + 1);
    if (bid < minDefenseBid) {
      throw createHttpError(400, `Defense bid must be >= ${minDefenseBid}`);
    }

    const profile = await this.getProfileByUserId(userId);
    const currentBalance = parsePositiveInt(profile.usua_nocoin, 0);
    if (currentBalance < bid) {
      throw createHttpError(400, 'Insufficient coin balance');
    }
    const balanceAfter = currentBalance - bid;

    await strapi.db.query('api::usua.usua' as any).update({
      where: { id: profile.id },
      data: { usua_nocoin: balanceAfter },
    });

    const updatedTile = await strapi.db.query('api::tile.tile' as any).update({
      where: { id: tileId },
      data: { tile_defense_max_bid: bid },
      populate: { tile_owner: true, tile_attack_max_bidder: true },
    });

    await this.createCoinLedgerEntry({
      entry_type: 'defense_bid',
      amount: -bid,
      balance_after: balanceAfter,
      reason: 'Manual defense bid',
      metadata: {
        tile_id: tileId,
        source: 'api.tiles.defend',
        previous_defense_max: currentDefenseMax,
      },
      user: userId,
      profile: profile.id,
      tile: tileId,
    });

    return {
      tile: updatedTile,
      balance: balanceAfter,
      bid,
    };
  },

  async resolveTileConflict(tileId: number, source: 'manual' | 'auto' = 'manual') {
    const tile = await strapi.db.query('api::tile.tile' as any).findOne({
      where: { id: tileId },
      populate: { tile_owner: true, tile_attack_max_bidder: true },
    });
    if (!tile) {
      throw createHttpError(404, 'Tile not found');
    }
    if (!tile.tile_uattac) {
      throw createHttpError(409, 'Tile has no active conflict');
    }
    if (!isPastOrNowDate(tile.tile_attack_ends_at)) {
      throw createHttpError(409, 'Conflict window has not ended yet');
    }

    const ownerId = Number(tile.tile_owner?.id);
    const attackerId = Number(tile.tile_attack_max_bidder?.id);
    const attackMaxBid = parsePositiveInt(tile.tile_attack_max_bid, 0);
    const defenseMaxBid = parsePositiveInt(tile.tile_defense_max_bid, 0);
    const nowIso = new Date().toISOString();

    if (!ownerId || !attackerId || attackMaxBid <= 0) {
      throw createHttpError(500, 'Corrupted conflict state');
    }

    const ownerProfile = await this.getProfileByUserId(ownerId);
    const attackerProfile = await this.getProfileByUserId(attackerId);

    let winner: 'defender' | 'attacker';
    let ownerBalanceAfter = parsePositiveInt(ownerProfile.usua_nocoin, 0);
    let attackerBalanceAfter = parsePositiveInt(attackerProfile.usua_nocoin, 0);
    let attackerRefund = 0;
    let attackerBurn = 0;
    let defenderRefund = 0;
    let defenderBurn = 0;
    let nextOwnerId = ownerId;
    let nextRealPrice = parsePositiveInt(tile.tile_real_price, 10);
    let nextStreakStart = tile.tile_streak_start_at;

    if (defenseMaxBid > attackMaxBid) {
      winner = 'defender';
      nextRealPrice = Math.ceil(nextRealPrice * 1.1);
      attackerRefund = Math.ceil(attackMaxBid * 0.3);
      attackerBurn = attackMaxBid - attackerRefund;
      attackerBalanceAfter += attackerRefund;

      await strapi.db.query('api::usua.usua' as any).update({
        where: { id: attackerProfile.id },
        data: { usua_nocoin: attackerBalanceAfter },
      });

      await this.createCoinLedgerEntry({
        entry_type: 'refund',
        amount: attackerRefund,
        balance_after: attackerBalanceAfter,
        reason: 'Refund to final attacker after successful defense',
        metadata: { tile_id: tileId, source: `api.tiles.resolve.${source}` },
        user: attackerId,
        profile: attackerProfile.id,
        tile: tileId,
      });

      await strapi.db.query('api::burn-log.burn-log' as any).create({
        data: {
          amount: attackerBurn,
          reason: 'Attacker burn after successful defense',
          metadata: { tile_id: tileId, source: `api.tiles.resolve.${source}` },
          user: attackerId,
          profile: attackerProfile.id,
          tile: tileId,
        },
      });
    } else {
      winner = 'attacker';
      nextOwnerId = attackerId;
      nextRealPrice = attackMaxBid;
      nextStreakStart = nowIso;

      if (defenseMaxBid > 0) {
        defenderBurn = Math.ceil(defenseMaxBid * 0.5);
        defenderRefund = defenseMaxBid - defenderBurn;
        ownerBalanceAfter += defenderRefund;

        await strapi.db.query('api::usua.usua' as any).update({
          where: { id: ownerProfile.id },
          data: { usua_nocoin: ownerBalanceAfter },
        });

        await this.createCoinLedgerEntry({
          entry_type: 'refund',
          amount: defenderRefund,
          balance_after: ownerBalanceAfter,
          reason: 'Partial refund to defender after failed defense',
          metadata: { tile_id: tileId, source: `api.tiles.resolve.${source}` },
          user: ownerId,
          profile: ownerProfile.id,
          tile: tileId,
        });

        await strapi.db.query('api::burn-log.burn-log' as any).create({
          data: {
            amount: defenderBurn,
            reason: 'Defender burn after failed defense',
            metadata: { tile_id: tileId, source: `api.tiles.resolve.${source}` },
            user: ownerId,
            profile: ownerProfile.id,
            tile: tileId,
          },
        });
      }
    }

    await strapi.db.query('api::attack-bid.attack-bid' as any).updateMany({
      where: { tile: tileId, status: 'active_max' },
      data: { status: winner === 'attacker' ? 'resolved_win' : 'resolved_loss' },
    });

    const updatedTile = await strapi.db.query('api::tile.tile' as any).update({
      where: { id: tileId },
      data: {
        tile_owner: nextOwnerId,
        tile_real_price: nextRealPrice,
        tile_streak_start_at: nextStreakStart,
        tile_uattac: false,
        tile_attack_started_at: null,
        tile_attack_ends_at: null,
        tile_attack_max_bid: 0,
        tile_attack_max_bidder: null,
        tile_defense_max_bid: 0,
        tile_prepared_defense_active: false,
        tile_prepared_defense_type: null,
        tile_prepared_defense_cushion: 0,
        tile_prepared_defense_trigger_at: null,
      },
      populate: { tile_owner: true },
    });

    return {
      winner,
      tile: updatedTile,
      attack_max_bid: attackMaxBid,
      defense_max_bid: defenseMaxBid,
      attacker_refund: attackerRefund,
      attacker_burn: attackerBurn,
      defender_refund: defenderRefund,
      defender_burn: defenderBurn,
    };
  },

  async configurePreparedDefense(
    userId: number,
    tileId: number,
    type: 'instant' | 'm10' | 'h1' | 'h12',
    cushion: number
  ) {
    const tile = await strapi.db.query('api::tile.tile' as any).findOne({
      where: { id: tileId },
      populate: { tile_owner: true },
    });
    if (!tile) {
      throw createHttpError(404, 'Tile not found');
    }
    if (!tile.tile_owner || Number(tile.tile_owner.id) !== userId) {
      throw createHttpError(403, 'Only the tile owner can configure prepared defense');
    }
    if (tile.tile_uattac && isFutureDate(tile.tile_attack_ends_at)) {
      throw createHttpError(409, 'Cannot configure prepared defense during active attack');
    }

    const settings = await strapi.db.query('api::game-setting.game-setting' as any).findOne({
      orderBy: { id: 'desc' },
    });
    const percent = this.getPreparedDefensePercentByType(settings, type);
    const realPrice = parsePositiveInt(tile.tile_real_price, 10);
    const extraCost = Math.ceil(realPrice * percent);
    const totalCost = extraCost + cushion;

    const profile = await this.getProfileByUserId(userId);
    const currentBalance = parsePositiveInt(profile.usua_nocoin, 0);
    if (currentBalance < totalCost) {
      throw createHttpError(400, 'Insufficient coin balance');
    }
    const balanceAfter = currentBalance - totalCost;

    await strapi.db.query('api::usua.usua' as any).update({
      where: { id: profile.id },
      data: { usua_nocoin: balanceAfter },
    });

    const updatedTile = await strapi.db.query('api::tile.tile' as any).update({
      where: { id: tileId },
      data: {
        tile_prepared_defense_active: true,
        tile_prepared_defense_type: type,
        tile_prepared_defense_cushion: cushion,
        tile_prepared_defense_trigger_at: null,
      },
      populate: { tile_owner: true },
    });

    await this.createCoinLedgerEntry({
      entry_type: 'prepared_defense_setup',
      amount: -totalCost,
      balance_after: balanceAfter,
      reason: 'Prepared defense setup cost',
      metadata: {
        tile_id: tileId,
        type,
        cushion,
        extra_cost: extraCost,
        source: 'api.tiles.prepared-defense',
      },
      user: userId,
      profile: profile.id,
      tile: tileId,
    });

    return {
      tile: updatedTile,
      balance: balanceAfter,
      charged: totalCost,
      extra_cost: extraCost,
      cushion,
      type,
    };
  },

  async buyShield(userId: number, tileId: number, hours: number) {
    const tile = await strapi.db.query('api::tile.tile' as any).findOne({
      where: { id: tileId },
      populate: { tile_owner: true },
    });
    if (!tile) {
      throw createHttpError(404, 'Tile not found');
    }
    if (!tile.tile_owner || Number(tile.tile_owner.id) !== userId) {
      throw createHttpError(403, 'Only the tile owner can buy shield');
    }
    if (tile.tile_uattac && isFutureDate(tile.tile_attack_ends_at)) {
      throw createHttpError(409, 'Cannot buy shield during active attack');
    }

    const settings = await strapi.db.query('api::game-setting.game-setting' as any).findOne({
      orderBy: { id: 'desc' },
    });
    const shieldCostPerHour = parsePositiveInt(settings?.shield_cost_per_hour, 5);
    const cost = Math.ceil(shieldCostPerHour * hours);

    const profile = await this.getProfileByUserId(userId);
    const currentBalance = parsePositiveInt(profile.usua_nocoin, 0);
    if (currentBalance < cost) {
      throw createHttpError(400, 'Insufficient coin balance');
    }
    const balanceAfter = currentBalance - cost;

    await strapi.db.query('api::usua.usua' as any).update({
      where: { id: profile.id },
      data: { usua_nocoin: balanceAfter },
    });

    const baseDate = isFutureDate(tile.tile_shield_ends_at)
      ? new Date(String(tile.tile_shield_ends_at))
      : new Date();
    const newShieldEnd = new Date(baseDate.getTime() + hours * 60 * 60 * 1000).toISOString();

    const updatedTile = await strapi.db.query('api::tile.tile' as any).update({
      where: { id: tileId },
      data: { tile_shield_ends_at: newShieldEnd },
      populate: { tile_owner: true },
    });

    await this.createCoinLedgerEntry({
      entry_type: 'shield_buy',
      amount: -cost,
      balance_after: balanceAfter,
      reason: 'Shield purchase',
      metadata: {
        tile_id: tileId,
        hours,
        cost_per_hour: shieldCostPerHour,
        source: 'api.tiles.shield',
      },
      user: userId,
      profile: profile.id,
      tile: tileId,
    });

    return {
      tile: updatedTile,
      balance: balanceAfter,
      charged: cost,
      shield_ends_at: newShieldEnd,
    };
  },

  async processPreparedDefenseTriggers() {
    const nowIso = new Date().toISOString();
    const candidates = await strapi.db.query('api::tile.tile' as any).findMany({
      where: {
        tile_prepared_defense_active: true,
        tile_uattac: true,
        tile_prepared_defense_trigger_at: { $lte: nowIso },
        tile_attack_ends_at: { $gt: nowIso },
      },
      populate: { tile_owner: true, tile_attack_max_bidder: true },
    });

    const results = [];
    for (const tile of candidates) {
      const attackMax = parsePositiveInt(tile.tile_attack_max_bid, 0);
      const cushion = parsePositiveInt(tile.tile_prepared_defense_cushion, 0);
      const threshold = parsePositiveInt(tile.tile_real_price, 10) + cushion;

      if (attackMax > 0 && attackMax <= threshold) {
        const autoDefenseBid = Math.max(attackMax + 1, parsePositiveInt(tile.tile_defense_max_bid, 0));
        await strapi.db.query('api::tile.tile' as any).update({
          where: { id: tile.id },
          data: {
            tile_defense_max_bid: autoDefenseBid,
            tile_prepared_defense_active: false,
            tile_prepared_defense_trigger_at: null,
          },
        });
        const resolution = await this.resolveTileConflict(Number(tile.id), 'auto');
        results.push({ tile_id: tile.id, status: 'auto_defended', winner: resolution.winner });
      } else {
        await strapi.db.query('api::tile.tile' as any).update({
          where: { id: tile.id },
          data: {
            tile_prepared_defense_active: false,
            tile_prepared_defense_trigger_at: null,
          },
        });
        results.push({ tile_id: tile.id, status: 'trigger_failed_manual_required' });
      }
    }

    return {
      scanned: candidates.length,
      processed: results.length,
      results,
    };
  },

  async runMaintenanceCycle(source: 'manual' | 'auto' = 'manual') {
    const settings = await strapi.db.query('api::game-setting.game-setting' as any).findOne({
      orderBy: { id: 'desc' },
    });
    if (!settings?.id) {
      throw createHttpError(400, 'Game Settings must be configured before running maintenance');
    }
    const maintenancePercent = Number(settings?.maintenance_percent ?? 0.1);
    const baseTilePrice = parsePositiveInt(settings?.base_tile_price, 10);
    const nowIso = new Date().toISOString();

    if (!Number.isFinite(maintenancePercent) || maintenancePercent < 0) {
      throw createHttpError(500, 'Invalid maintenance percent in Game Settings');
    }

    const tiles = await strapi.db.query('api::tile.tile' as any).findMany({
      where: { tile_owner: { id: { $notNull: true } } },
      populate: { tile_owner: true },
    });

    const byOwner = new Map<number, any[]>();
    for (const tile of tiles) {
      const ownerId = Number(tile.tile_owner?.id);
      if (!ownerId) continue;
      const list = byOwner.get(ownerId) ?? [];
      list.push(tile);
      byOwner.set(ownerId, list);
    }

    const results = [];
    for (const [ownerId, ownerTiles] of byOwner.entries()) {
      const profile = await this.getProfileByUserId(ownerId);
      const currentBalance = parsePositiveInt(profile.usua_nocoin, 0);

      const costsPerTile = ownerTiles.map((tile) => ({
        id: Number(tile.id),
        cost: Math.ceil(parsePositiveInt(tile.tile_real_price, baseTilePrice) * maintenancePercent),
      }));
      const totalCost = costsPerTile.reduce((sum, item) => sum + item.cost, 0);

      if (currentBalance >= totalCost) {
        const balanceAfter = currentBalance - totalCost;
        await strapi.db.query('api::usua.usua' as any).update({
          where: { id: profile.id },
          data: { usua_nocoin: balanceAfter },
        });

        await this.createCoinLedgerEntry({
          entry_type: 'maintenance',
          amount: -totalCost,
          balance_after: balanceAfter,
          reason: `Scheduled maintenance (${source})`,
          metadata: {
            source: `maintenance.${source}`,
            tile_count: ownerTiles.length,
            tiles: costsPerTile,
          },
          user: ownerId,
          profile: profile.id,
        });

        results.push({
          user_id: ownerId,
          status: 'charged',
          total_cost: totalCost,
          tile_count: ownerTiles.length,
          balance_after: balanceAfter,
        });
      } else {
        const tileIds = ownerTiles.map((tile) => Number(tile.id));
        for (const tile of ownerTiles) {
          await strapi.db.query('api::tile.tile' as any).update({
            where: { id: tile.id },
            data: {
              tile_owner: null,
              tile_real_price: baseTilePrice,
              tile_messag: null,
              tile_image: null,
              tile_links: null,
              tile_streak_start_at: null,
              tile_uattac: false,
              tile_attack_started_at: null,
              tile_attack_ends_at: null,
              tile_attack_max_bid: 0,
              tile_attack_max_bidder: null,
              tile_defense_max_bid: 0,
              tile_shield_ends_at: null,
              tile_prepared_defense_active: false,
              tile_prepared_defense_type: null,
              tile_prepared_defense_cushion: 0,
              tile_prepared_defense_trigger_at: null,
            },
          });
        }

        await strapi.db.query('api::burn-log.burn-log' as any).create({
          data: {
            amount: totalCost > 0 ? totalCost : 1,
            reason: 'Maintenance abandonment',
            metadata: {
              source: `maintenance.${source}`,
              tile_ids: tileIds,
              required_amount: totalCost,
              user_balance_before: currentBalance,
            },
            user: ownerId,
            profile: profile.id,
          },
        });

        results.push({
          user_id: ownerId,
          status: 'abandoned',
          required_cost: totalCost,
          tile_count: ownerTiles.length,
          tile_ids: tileIds,
          balance_before: currentBalance,
        });
      }
    }

    await strapi.db.query('api::game-setting.game-setting' as any).update({
      where: { id: settings.id },
      data: { last_maintenance_run_at: nowIso },
    });

    return {
      source,
      processed_users: results.length,
      results,
      ran_at: nowIso,
    };
  },

  async maybeRunScheduledMaintenance() {
    const settings = await strapi.db.query('api::game-setting.game-setting' as any).findOne({
      orderBy: { id: 'desc' },
    });
    if (!settings?.id) {
      return { skipped: true, reason: 'missing_game_settings' };
    }
    const intervalDays = parsePositiveInt(settings?.maintenance_days_interval, 15);
    const lastRun = settings?.last_maintenance_run_at
      ? new Date(String(settings.last_maintenance_run_at)).getTime()
      : 0;
    const nowMs = Date.now();
    const intervalMs = intervalDays * 24 * 60 * 60 * 1000;

    if (lastRun && nowMs - lastRun < intervalMs) {
      return { skipped: true, reason: 'interval_not_elapsed' };
    }

    const result = await this.runMaintenanceCycle('auto');
    return { skipped: false, ...result };
  },

  async resolveExpiredConflicts() {
    const expiredTiles = await strapi.db.query('api::tile.tile' as any).findMany({
      where: {
        tile_uattac: true,
        tile_attack_ends_at: { $lte: new Date().toISOString() },
      },
      select: ['id'],
    });

    const results = [];
    for (const tile of expiredTiles) {
      try {
        const result = await this.resolveTileConflict(Number(tile.id), 'auto');
        results.push({ tile_id: tile.id, status: 'resolved', winner: result.winner });
      } catch (error) {
        const safeError = error as Error;
        results.push({ tile_id: tile.id, status: 'failed', error: safeError.message });
      }
    }

    return {
      scanned: expiredTiles.length,
      processed: results.length,
      results,
    };
  },
}));
