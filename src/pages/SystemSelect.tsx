import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Bluetooth, BookOpen, Zap, Activity } from "lucide-react";
import acPremiumIcon from "@/assets/ac-premium-icon.png";
import patternBg from "@/assets/pattern-bg.jpg";
import { SystemType } from "@/types/bluetooth";

const SystemSelect = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const systemType: SystemType = (searchParams.get('type')?.toUpperCase() as SystemType) || 'SKA';

  const systemInfo: Record<SystemType, {
    title: string;
    fullName: string;
    description: string;
    color: string;
    glowColor: string;
    components: string[];
  }> = {
    SKA: {
      title: 'СКА',
      fullName: 'Система кондиционирования аппаратуры',
      description: 'Профессиональная диагностика аппаратурной части системы кондиционирования с 2 вентиляторами конденсатора',
      color: 'primary',
      glowColor: 'primary',
      components: [
        'Блок силовой коммутации и управления (БСКУ)',
        'Агрегат компрессорно-конденсаторный',
        'Блок испарителя',
        'Коммутационная коробка с термостатом',
        '2 вентилятора конденсатора (M1, M2)'
      ]
    },
    SKE: {
      title: 'СКЭ',
      fullName: 'Система кондиционирования экипажа',
      description: 'Профессиональная диагностика экипажной части системы кондиционирования с 3 вентиляторами конденсатора',
      color: 'secondary',
      glowColor: 'secondary',
      components: [
        'Блок силовой коммутации и управления (БСКУ)',
        'Агрегат конденсаторный',
        'Агрегат компрессорный',
        'Блок испарителя',
        'Пульт климат-контроль (ПКК)',
        'Коммутационная коробка',
        '3 вентилятора конденсатора (M1, M2, M3)'
      ]
    }
  };

  const info = systemInfo[systemType];

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Premium Background */}
      <div className="absolute inset-0">
        <div 
          className="absolute inset-0 opacity-10 bg-cover bg-center"
          style={{ backgroundImage: `url(${patternBg})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background/95 to-background" />
      </div>

      {/* Floating orbs */}
      <div className={`absolute top-1/3 right-1/4 w-96 h-96 bg-${info.color}/10 rounded-full blur-[100px] animate-pulse`} />
      
      {/* Premium Header */}
      <header className="glass-header sticky top-0 z-50">
        <div className="container mx-auto px-4 py-5 flex items-center justify-between">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/')}
            className="text-foreground hover:text-primary hover:bg-primary/10 transition-all duration-300"
          >
            <ArrowLeft className="mr-2 h-5 w-5" />
            <span className="font-semibold">Назад</span>
          </Button>
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <Activity className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-3xl font-black gradient-text">{info.title}</h1>
          </div>
          
          <div className="w-24" />
        </div>
      </header>

      <main className="relative container mx-auto px-4 py-12 pb-24 space-y-10 safe-bottom">
        
        {/* Premium System Info Card */}
        <Card className="premium-card p-10 animate-fade-in">
          <div className="flex flex-col lg:flex-row items-center gap-10">
            
            {/* Premium Icon with Glow */}
            <div className="relative flex-shrink-0">
              <div className={`absolute inset-0 bg-${info.glowColor}/20 rounded-3xl blur-3xl`} />
              <div className="relative w-48 h-48 rounded-3xl bg-gradient-to-br from-card via-card/90 to-card/80 backdrop-blur-sm border border-border/50 p-6 flex items-center justify-center">
                <img 
                  src={acPremiumIcon} 
                  alt="AC System" 
                  className="w-full h-full object-contain drop-shadow-2xl"
                />
              </div>
            </div>
            
            {/* Content */}
            <div className="flex-1 text-center lg:text-left space-y-6">
              <div>
                <h2 className="text-4xl font-black mb-3 gradient-text leading-tight">
                  {info.fullName}
                </h2>
                <p className="text-xl text-muted-foreground font-light leading-relaxed">
                  {info.description}
                </p>
              </div>
              
              {/* Premium Components List */}
              <div className="glass-card p-6 rounded-2xl">
                <div className="flex items-center gap-2 mb-4">
                  <Zap className="w-5 h-5 text-accent" />
                  <p className="text-sm font-bold text-foreground uppercase tracking-wider">Компоненты системы</p>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  {info.components.map((component, index) => (
                    <div 
                      key={index}
                      className="flex items-start gap-3 text-sm text-muted-foreground bg-muted/30 p-3 rounded-xl hover:bg-muted/50 transition-colors duration-300"
                    >
                      <span className={`text-${info.color} mt-0.5 font-bold`}>▸</span>
                      <span className="font-medium">{component}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Premium Action Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          
          {/* Connect Card */}
          <Card 
            className="group relative overflow-hidden premium-card cursor-pointer animate-scale-in"
            onClick={() => navigate(`/bluetooth-connect?type=${systemType}`)}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-700" />
            
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none">
              <div className="absolute top-0 left-0 w-full h-full bg-primary/10 blur-2xl" />
            </div>
            
            <div className="relative p-8 sm:p-10 flex flex-col items-center text-center space-y-5 sm:space-y-6 min-h-[400px] sm:min-h-[450px]">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-2xl group-hover:blur-3xl transition-all duration-700" />
                <div className="relative w-24 h-24 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 backdrop-blur-sm border border-primary/30 flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-700">
                  <Bluetooth className="w-12 h-12 text-primary animate-pulse drop-shadow-[0_0_20px_rgba(59,130,246,0.5)]" />
                </div>
              </div>
              
              <div className="space-y-3">
                <h3 className="text-3xl font-black text-foreground group-hover:text-primary transition-colors duration-300">
                  Подключиться
                </h3>
                <p className="text-muted-foreground font-light leading-relaxed">
                  Подключение к БСКУ<br />через Bluetooth
                </p>
              </div>
              
              <Button className="w-full btn-glow-primary bg-primary hover:bg-primary-glow text-primary-foreground font-semibold py-6 sm:py-7 text-base sm:text-lg rounded-xl shadow-lg transition-all duration-300 hover:scale-105 min-h-[56px]">
                Начать диагностику
              </Button>
            </div>
          </Card>

          {/* Repair Guide Card */}
          <Card 
            className="group relative overflow-hidden premium-card cursor-pointer animate-scale-in [animation-delay:100ms]"
            onClick={() => navigate(`/repair-guide?type=${systemType}`)}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-accent/20 via-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-700" />
            
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none">
              <div className="absolute top-0 left-0 w-full h-full bg-accent/10 blur-2xl" />
            </div>
            
            <div className="relative p-8 sm:p-10 flex flex-col items-center text-center space-y-5 sm:space-y-6 min-h-[400px] sm:min-h-[450px]">
              <div className="relative">
                <div className="absolute inset-0 bg-accent/20 rounded-2xl blur-2xl group-hover:blur-3xl transition-all duration-700" />
                <div className="relative w-24 h-24 rounded-2xl bg-gradient-to-br from-accent/30 to-accent/10 backdrop-blur-sm border border-accent/30 flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-700">
                  <BookOpen className="w-12 h-12 text-accent drop-shadow-[0_0_20px_rgba(6,182,212,0.5)]" />
                </div>
              </div>
              
              <div className="space-y-3">
                <h3 className="text-3xl font-black text-foreground group-hover:text-accent transition-colors duration-300">
                  Руководство
                </h3>
                <p className="text-muted-foreground font-light leading-relaxed">
                  База знаний<br />по ремонту
                </p>
              </div>
              
              <Button className="w-full bg-gradient-to-r from-accent to-accent-glow hover:from-accent-glow hover:to-accent text-accent-foreground font-semibold py-6 sm:py-7 text-base sm:text-lg rounded-xl shadow-lg shadow-accent/20 transition-all duration-300 hover:scale-105 hover:shadow-accent/40 min-h-[56px]">
                Открыть справку
              </Button>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default SystemSelect;
