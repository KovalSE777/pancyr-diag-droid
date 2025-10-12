import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Settings, Wrench } from "lucide-react";
import heroBackground from "@/assets/hero-background.jpg";

const Index = () => {
  const navigate = useNavigate();

  return (
    <main className="min-h-screen relative overflow-hidden">
      {/* Background */}
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-40"
        style={{ backgroundImage: `url(${heroBackground})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background/95 to-background" />
      
      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 py-8 sm:py-12 min-h-screen flex flex-col">
        {/* Header */}
        <header className="text-center mb-12 sm:mb-16 animate-fade-in">
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold mb-4 bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
            Панцирь
          </h1>
          <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground mb-2 px-4">
            Система диагностики кондиционирования
          </p>
          <div className="w-24 sm:w-32 h-1 mx-auto bg-gradient-to-r from-primary via-accent to-secondary rounded-full" />
        </header>

        {/* Main Cards */}
        <div className="flex-1 flex items-center justify-center">
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl w-full">
            {/* SKA Card */}
            <Card 
              className="group relative overflow-hidden bg-card border-border hover:border-primary transition-all duration-300 cursor-pointer animate-scale-in"
              onClick={() => navigate('/system-select?type=ska')}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative p-8 h-full flex flex-col items-center justify-center text-center space-y-6">
                <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Settings className="w-12 h-12 text-primary" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold mb-2 text-foreground group-hover:text-primary transition-colors">
                    СКА
                  </h2>
                  <p className="text-lg text-muted-foreground mb-4">
                    Система кондиционирования<br />аппаратуры
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-2 text-left">
                    <li>• Блок силовой коммутации (БСКУ)</li>
                    <li>• Компрессорно-конденсаторный агрегат</li>
                    <li>• Блок испарителя</li>
                    <li>• Термостат 27-34°C</li>
                  </ul>
                </div>
                <Button className="w-full bg-primary hover:bg-primary-glow">
                  Выбрать СКА
                </Button>
              </div>
            </Card>

            {/* SKE Card */}
            <Card 
              className="group relative overflow-hidden bg-card border-border hover:border-secondary transition-all duration-300 cursor-pointer animate-scale-in [animation-delay:100ms]"
              onClick={() => navigate('/system-select?type=ske')}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-secondary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative p-8 h-full flex flex-col items-center justify-center text-center space-y-6">
                <div className="w-24 h-24 rounded-full bg-secondary/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Wrench className="w-12 h-12 text-secondary" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold mb-2 text-foreground group-hover:text-secondary transition-colors">
                    СКЭ
                  </h2>
                  <p className="text-lg text-muted-foreground mb-4">
                    Система кондиционирования<br />экипажа
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-2 text-left">
                    <li>• Блок силовой коммутации (БСКУ)</li>
                    <li>• Агрегат конденсаторный</li>
                    <li>• Агрегат компрессорный</li>
                    <li>• Блок испарителя</li>
                    <li>• Пульт климат-контроль (ПКК)</li>
                  </ul>
                </div>
                <Button className="w-full bg-secondary hover:bg-secondary-glow">
                  Выбрать СКЭ
                </Button>
              </div>
            </Card>
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center mt-16 text-sm text-muted-foreground">
          <p>Версия 1.0 • Диагностика через Bluetooth</p>
        </footer>
      </div>
    </main>
  );
};

export default Index;
