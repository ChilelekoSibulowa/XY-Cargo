import { Navigate } from "react-router-dom";

const WarehouseDashboard = () => {
  return <Navigate to="/warehouse/parcels?tab=all" replace />;
};

export default WarehouseDashboard;