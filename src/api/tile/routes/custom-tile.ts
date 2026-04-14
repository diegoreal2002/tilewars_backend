export default {
  routes: [
    {
      method: 'POST',
      path: '/tiles/:id/buy-free',
      handler: 'tile.purchaseFreeTile',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/tiles/:id/attack',
      handler: 'tile.startAttack',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/tiles/:id/outbid',
      handler: 'tile.outbidAttack',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/tiles/:id/defend',
      handler: 'tile.defendTile',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/tiles/:id/resolve',
      handler: 'tile.resolveConflict',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/tiles/:id/prepared-defense',
      handler: 'tile.configurePreparedDefense',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/tiles/:id/shield',
      handler: 'tile.buyShield',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
