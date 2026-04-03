/**
 * maintenance router
 */

export default {
  routes: [
    {
      method: 'POST',
      path: '/maintenance/run',
      handler: 'maintenance.run',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
