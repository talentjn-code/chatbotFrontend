import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const GoogleCallbackRedirect = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Forward all query params to /auth/callback
    navigate(`/auth/callback${location.search}`, { replace: true });
  }, [navigate, location.search]);

  return null;
};

export default GoogleCallbackRedirect;
