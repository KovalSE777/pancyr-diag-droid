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
      {/* Multi-layer Premium Background */}
      <div className="absolute inset-0">
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroGradientBg})` }}
        />
        <div 
          className="absolute inset-0 opacity-20 bg-cover bg-center mix-blend-overlay"
          style={{ backgroundImage: `url(${patternBg})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
      </div>
      
      {/* Animated floating orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-[120px] animate-pulse [animation-delay:2s]" />
      
      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 py-8 sm:py-12 min-h-screen flex flex-col">
        {/* Premium Header */}
        <header className="text-center mb-16 sm:mb-20 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 mb-6 rounded-full glass-card">
            <Sparkles className="w-4 h-4 text-accent animate-pulse" />
            <span className="text-sm font-medium text-accent">Профессиональная диагностика</span>
          </div>
          
          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black mb-6 gradient-text leading-tight">
            Панцирь
          </h1>
          
          <p className="text-lg sm:text-xl md:text-2xl lg:text-3xl text-muted-foreground mb-4 px-4 font-light leading-relaxed max-w-3xl mx-auto">
            Система диагностики<br className="sm:hidden" /> кондиционирования
          </p>
          
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="h-px w-16 bg-gradient-to-r from-transparent via-primary to-transparent" />
            <Zap className="w-5 h-5 text-primary animate-pulse" />
            <div className="h-px w-16 bg-gradient-to-r from-transparent via-primary to-transparent" />
          </div>
          
          <div className="flex flex-wrap justify-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-2 glass-card px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 bg-success rounded-full animate-pulse" />
              Bluetooth подключение
            </span>
            <span className="flex items-center gap-2 glass-card px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 bg-accent rounded-full animate-pulse" />
              Реальное время
            </span>
            <span className="flex items-center gap-2 glass-card px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
              Полная диагностика
            </span>
          </div>
        </header>

        {/* Premium Main Cards */}
        <div className="flex-1 flex items-center justify-center pb-8 px-2">
          <div className="grid md:grid-cols-2 gap-6 sm:gap-8 max-w-6xl w-full">
            
            {/* Premium SKA Card */}
            <Card 
              className="group relative overflow-hidden premium-card cursor-pointer animate-scale-in"
              onClick={() => navigate('/system-select?type=ska')}
            >
              {/* Animated gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-700" />
              
              {/* Glow effect on hover */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none">
                <div className="absolute top-0 left-0 w-full h-full bg-primary/10 blur-2xl" />
              </div>
              
              <div className="relative p-8 sm:p-10 h-full flex flex-col items-center justify-center text-center space-y-6 sm:space-y-8 min-h-[500px] sm:min-h-[550px]">
                {/* Premium Icon Container */}
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/20 rounded-3xl blur-2xl group-hover:blur-3xl transition-all duration-700" />
                  <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-gradient-to-br from-primary/30 to-primary/10 backdrop-blur-sm border border-primary/30 flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-700">
                    <Settings className="w-12 h-12 sm:w-14 sm:h-14 text-primary drop-shadow-[0_0_20px_rgba(59,130,246,0.5)]" />
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h2 className="text-4xl font-black text-foreground group-hover:text-primary transition-colors duration-300">
                    СКА
                  </h2>
                  
                  <p className="text-lg text-muted-foreground font-light leading-relaxed">
                    Система кондиционирования<br />аппаратуры
                  </p>
                  
                  <div className="glass-card p-4 rounded-xl space-y-2 text-left">
                    <div className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="text-primary mt-0.5">▸</span>
                      <span>Блок силовой коммутации (БСКУ)</span>
                    </div>
                    <div className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="text-primary mt-0.5">▸</span>
                      <span>Компрессорно-конденсаторный агрегат</span>
                    </div>
                    <div className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="text-primary mt-0.5">▸</span>
                      <span>Блок испарителя</span>
                    </div>
                    <div className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="text-primary mt-0.5">▸</span>
                      <span>Термостат 27-34°C</span>
                    </div>
                  </div>
                </div>
                
                <Button className="w-full btn-glow-primary bg-primary hover:bg-primary-glow text-primary-foreground font-semibold py-6 sm:py-7 text-base sm:text-lg rounded-xl shadow-lg transition-all duration-300 hover:scale-105 min-h-[56px]">
                  Выбрать СКА
                </Button>
              </div>
            </Card>

            {/* Premium SKE Card */}
            <Card 
              className="group relative overflow-hidden premium-card cursor-pointer animate-scale-in [animation-delay:150ms]"
              onClick={() => navigate('/system-select?type=ske')}
            >
              {/* Animated gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-secondary/20 via-secondary/5 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-700" />
              
              {/* Glow effect on hover */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none">
                <div className="absolute top-0 left-0 w-full h-full bg-secondary/10 blur-2xl" />
              </div>
              
              <div className="relative p-8 sm:p-10 h-full flex flex-col items-center justify-center text-center space-y-6 sm:space-y-8 min-h-[500px] sm:min-h-[550px]">
                {/* Premium Icon Container */}
                <div className="relative">
                  <div className="absolute inset-0 bg-secondary/20 rounded-3xl blur-2xl group-hover:blur-3xl transition-all duration-700" />
                  <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-gradient-to-br from-secondary/30 to-secondary/10 backdrop-blur-sm border border-secondary/30 flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-700">
                    <Wrench className="w-12 h-12 sm:w-14 sm:h-14 text-secondary drop-shadow-[0_0_20px_rgba(251,146,60,0.5)]" />
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h2 className="text-4xl font-black text-foreground group-hover:text-secondary transition-colors duration-300">
                    СКЭ
                  </h2>
                  
                  <p className="text-lg text-muted-foreground font-light leading-relaxed">
                    Система кондиционирования<br />экипажа
                  </p>
                  
                  <div className="glass-card p-4 rounded-xl space-y-2 text-left">
                    <div className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="text-secondary mt-0.5">▸</span>
                      <span>Блок силовой коммутации (БСКУ)</span>
                    </div>
                    <div className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="text-secondary mt-0.5">▸</span>
                      <span>Агрегат конденсаторный</span>
                    </div>
                    <div className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="text-secondary mt-0.5">▸</span>
                      <span>Агрегат компрессорный</span>
                    </div>
                    <div className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="text-secondary mt-0.5">▸</span>
                      <span>Блок испарителя</span>
                    </div>
                    <div className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="text-secondary mt-0.5">▸</span>
                      <span>Пульт климат-контроль (ПКК)</span>
                    </div>
                  </div>
                </div>
                
                <Button className="w-full btn-glow-secondary bg-secondary hover:bg-secondary-glow text-secondary-foreground font-semibold py-6 sm:py-7 text-base sm:text-lg rounded-xl shadow-lg transition-all duration-300 hover:scale-105 min-h-[56px]">
                  Выбрать СКЭ
                </Button>
              </div>
            </Card>
          </div>
        </div>

        {/* Premium Footer */}
        <footer className="text-center mt-12 space-y-2 animate-fade-in [animation-delay:300ms]">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground glass-card px-4 py-2 rounded-full inline-flex">
            <span className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />
            <span>Версия 1.0 • Bluetooth диагностика • Профессиональный уровень</span>
          </div>
        </footer>
      </div>
    </main>
  );
};

export default Index;
