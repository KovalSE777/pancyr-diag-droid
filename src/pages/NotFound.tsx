import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404: Route not found:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full p-8 text-center space-y-6 bg-card border-border">
        <div className="flex justify-center">
          <AlertTriangle className="w-20 h-20 text-destructive" />
        </div>
        <div>
          <h1 className="text-4xl font-bold mb-2 text-foreground">404</h1>
          <p className="text-xl text-muted-foreground mb-4">Страница не найдена</p>
          <p className="text-sm text-muted-foreground">
            Запрошенная страница не существует: <code className="bg-muted px-2 py-1 rounded text-xs">{location.pathname}</code>
          </p>
        </div>
        <Button 
          onClick={() => navigate('/')}
          className="w-full bg-primary hover:bg-primary-glow"
        >
          Вернуться на главную
        </Button>
      </Card>
    </div>
  );
};

export default NotFound;
