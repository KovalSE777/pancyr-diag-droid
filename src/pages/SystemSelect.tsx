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
    <div className="min-h-screen bg-background relative overflow-hidden safe-top safe-bottom">
      {/* Multi-layer Optimized Background */}
      <div className="absolute inset-0">
        <div 
          className="absolute inset-0 opacity-30 bg-cover bg-center"
          style={{ backgroundImage: `url(${patternBg})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/75 via-background/90 to-background" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
      </div>
      
      {/* Subtle glow */}
      <div className={`absolute top-1/3 right-1/4 w-64 h-64 bg-${info.color}/5 rounded-full blur-3xl`} />
      
      {/* Compact Header */}
      <header className="glass-header sticky top-0 z-50">
        <div className="container mx-auto px-3 py-3 flex items-center justify-between">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/')}
            className="text-foreground hover:text-primary -ml-2"
            size="sm"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            <span>Назад</span>
          </Button>
          
          <h1 className="text-2xl font-black gradient-text">{info.title}</h1>
          
          <div className="w-16" />
        </div>
      </header>

      <main className="relative container mx-auto px-3 py-4 pb-20 space-y-4">
        
        {/* Compact System Info Card */}
        <Card className="premium-card p-5">
          <div className="flex flex-col items-center gap-4">
            
            {/* Compact Icon */}
            <div className="relative w-28 h-28 rounded-2xl bg-card border border-border/50 p-4 flex items-center justify-center">
              <img 
                src={acPremiumIcon} 
                alt="AC System" 
                className="w-full h-full object-contain"
              />
            </div>
            
            {/* Content */}
            <div className="text-center space-y-3 w-full">
              <div>
                <h2 className="text-xl font-black mb-2 gradient-text">
                  {info.fullName}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {info.description}
                </p>
              </div>
              
              {/* Compact Components List */}
              <div className="glass-card p-3 rounded-xl">
                <div className="flex items-center gap-1.5 mb-2">
                  <Zap className="w-3 h-3 text-accent" />
                  <p className="text-xs font-bold text-foreground">Компоненты</p>
                </div>
                <div className="grid gap-1.5">
                  {info.components.map((component, index) => (
                    <div 
                      key={index}
                      className="flex items-start gap-1.5 text-xs text-muted-foreground"
                    >
                      <span className={`text-${info.color} mt-0.5`}>▸</span>
                      <span>{component}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Compact Action Cards */}
        <div className="grid md:grid-cols-2 gap-4">
          
          {/* Connect Card */}
          <Card 
            className="group premium-card cursor-pointer"
            onClick={() => navigate(`/bluetooth-connect?type=${systemType}`)}
          >
            <div className="relative p-5 flex flex-col items-center text-center space-y-3">
              <div className="w-16 h-16 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Bluetooth className="w-8 h-8 text-primary" />
              </div>
              
              <div className="space-y-1.5">
                <h3 className="text-xl font-black text-foreground group-hover:text-primary transition-colors">
                  Подключиться
                </h3>
                <p className="text-xs text-muted-foreground">
                  Bluetooth диагностика
                </p>
              </div>
              
              <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-5 text-sm rounded-lg transition-colors min-h-[48px]">
                Начать
              </Button>
            </div>
          </Card>

          {/* Repair Guide Card */}
          <Card 
            className="group premium-card cursor-pointer"
            onClick={() => navigate(`/repair-guide?type=${systemType}`)}
          >
            <div className="relative p-5 flex flex-col items-center text-center space-y-3">
              <div className="w-16 h-16 rounded-xl bg-accent/10 border border-accent/30 flex items-center justify-center group-hover:scale-105 transition-transform">
                <BookOpen className="w-8 h-8 text-accent" />
              </div>
              
              <div className="space-y-1.5">
                <h3 className="text-xl font-black text-foreground group-hover:text-accent transition-colors">
                  Руководство
                </h3>
                <p className="text-xs text-muted-foreground">
                  База знаний
                </p>
              </div>
              
              <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold py-5 text-sm rounded-lg transition-colors min-h-[48px]">
                Открыть
              </Button>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default SystemSelect;
