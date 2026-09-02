import { useEffect } from 'react';
import { useNavigate } from 'react-router';

export function POSMainPage() {
  const navigate = useNavigate();
  
  // Redirect to POS sales screen by default
  useEffect(() => {
    navigate('/pos', { replace: true });
  }, [navigate]);

  return null;
}
