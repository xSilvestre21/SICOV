const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const dashboardController = require('../controllers/dashboardController');

router.use(authMiddleware);

router.get('/clients-revenue', dashboardController.getClientsRevenue);
router.get('/commissions-overview', dashboardController.getCommissionsOverview);
router.get('/representatives-performance', dashboardController.getRepresentativesPerformance);
router.get('/top-clients', dashboardController.getTopClients);
router.get('/client/:clientId', dashboardController.getClientDetail);
router.get('/cancelled-orders', dashboardController.getCancelledOrders);
router.get('/suppliers-comparison', dashboardController.getSuppliersComparison);

module.exports = router;
