import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Settings, Wrench, Sparkles, Zap } from "lucide-react";
import heroGradientBg from "@/assets/hero-gradient-bg.jpg";
import patternBg from "@/assets/pattern-bg.jpg";

const Index = () => {
  const navigate = useNavigate();

  return (
    <main className="min-h-screen relative overflow-hidden">
      {/* Optimized Beautiful Background */}
      <div className="absolute inset-0">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-50"
          style={{ backgroundImage: `url(${heroGradientBg})` }}
        />
        <div 
          className="absolute inset-0 opacity-15 bg-cover bg-center"
          style={{ backgroundImage: `url(${patternBg})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/90 to-background" />
      </div>
      
      {/* Content */}
      <div className="relative z-10 container mx-auto px-3 py-4 min-h-screen flex flex-col safe-top safe-bottom">
        {/* Compact Header */}
        <header className="text-center mb-6 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-3 rounded-full glass-card">
            <Sparkles className="w-3 h-3 text-accent" />
            <span className="text-xs font-medium text-accent">Профессиональная диагностика</span>
          </div>
          
          <h1 className="text-4xl sm:text-5xl font-black mb-3 gradient-text leading-tight">
            Панцирь
          </h1>
          
          <p className="text-base sm:text-lg text-muted-foreground mb-3 px-3 font-light max-w-2xl mx-auto">
            Система диагностики кондиционирования
          </p>
          
          <div className="flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5 glass-card px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 bg-success rounded-full" />
              Bluetooth
            </span>
            <span className="flex items-center gap-1.5 glass-card px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 bg-accent rounded-full" />
              Реальное время
            </span>
            <span className="flex items-center gap-1.5 glass-card px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 bg-primary rounded-full" />
              Диагностика
            </span>
          </div>
        </header>

        {/* Compact Main Cards */}
        <div className="flex-1 flex items-center justify-center pb-4">
          <div className="grid md:grid-cols-2 gap-4 max-w-5xl w-full">
            
            {/* Compact SKA Card */}
            <Card 
              className="group relative overflow-hidden premium-card cursor-pointer"
              onClick={() => navigate('/system-select?type=ska')}
            >
              <div className="relative p-5 h-full flex flex-col items-center justify-center text-center space-y-4">
                {/* Icon */}
                <div className="relative w-20 h-20 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Settings className="w-10 h-10 text-primary" />
                </div>
                
                <div className="space-y-2">
                  <h2 className="text-3xl font-black text-foreground group-hover:text-primary transition-colors">
                    СКА
                  </h2>
                  
                  <p className="text-sm text-muted-foreground">
                    Система кондиционирования аппаратуры
                  </p>
                  
                  <div className="glass-card p-3 rounded-lg space-y-1.5 text-left">
                    <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <span className="text-primary mt-0.5">▸</span>
                      <span>БСКУ</span>
                    </div>
                    <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <span className="text-primary mt-0.5">▸</span>
                      <span>Компрессорно-конденсаторный агрегат</span>
                    </div>
                    <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <span className="text-primary mt-0.5">▸</span>
                      <span>Блок испарителя</span>
                    </div>
                    <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <span className="text-primary mt-0.5">▸</span>
                      <span>Термостат 27-34°C</span>
                    </div>
                  </div>
                </div>
                
                <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-5 text-sm rounded-lg transition-colors min-h-[48px]">
                  Выбрать СКА
                </Button>
              </div>
            </Card>

            {/* Compact SKE Card */}
            <Card 
              className="group relative overflow-hidden premium-card cursor-pointer"
              onClick={() => navigate('/system-select?type=ske')}
            >
              <div className="relative p-5 h-full flex flex-col items-center justify-center text-center space-y-4">
                {/* Icon */}
                <div className="relative w-20 h-20 rounded-2xl bg-secondary/10 border border-secondary/30 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Wrench className="w-10 h-10 text-secondary" />
                </div>
                
                <div className="space-y-2">
                  <h2 className="text-3xl font-black text-foreground group-hover:text-secondary transition-colors">
                    СКЭ
                  </h2>
                  
                  <p className="text-sm text-muted-foreground">
                    Система кондиционирования экипажа
                  </p>
                  
                  <div className="glass-card p-3 rounded-lg space-y-1.5 text-left">
                    <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <span className="text-secondary mt-0.5">▸</span>
                      <span>БСКУ</span>
                    </div>
                    <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <span className="text-secondary mt-0.5">▸</span>
                      <span>Агрегат конденсаторный</span>
                    </div>
                    <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <span className="text-secondary mt-0.5">▸</span>
                      <span>Агрегат компрессорный</span>
                    </div>
                    <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <span className="text-secondary mt-0.5">▸</span>
                      <span>Блок испарителя</span>
                    </div>
                    <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <span className="text-secondary mt-0.5">▸</span>
                      <span>ПКК</span>
                    </div>
                  </div>
                </div>
                
                <Button className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground font-semibold py-5 text-sm rounded-lg transition-colors min-h-[48px]">
                  Выбрать СКЭ
                </Button>
              </div>
            </Card>
          </div>
        </div>

        {/* Compact Footer */}
        <footer className="text-center mt-4">
          <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground glass-card px-3 py-1.5 rounded-full inline-flex">
            <span className="w-1.5 h-1.5 bg-success rounded-full" />
            <span>Версия 1.0</span>
          </div>
        </footer>
      </div>
    </main>
  );
};

export default Index;
