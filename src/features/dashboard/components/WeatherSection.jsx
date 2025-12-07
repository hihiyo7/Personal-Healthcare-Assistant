import React, { useState, useEffect } from 'react';
import { Thermometer, MapPin, Search, X, Droplets, Sun, CloudRain, Snowflake, Wind } from 'lucide-react';

const mapWeatherCodeToCondition = (code) => {
  if (code === null || code === undefined) return '데이터 없음';
  if ([0].includes(code)) return '맑음';
  if ([1, 2, 3].includes(code)) return '부분적으로 흐림';
  if ([45, 48].includes(code)) return '안개';
  if ([51, 53, 55, 56, 57].includes(code)) return '이슬비';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return '비';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return '눈';
  if ([95, 96, 99].includes(code)) return '뇌우';
  return '변덕스러운 날씨';
};

const getWeatherIcon = (code, isDarkMode) => {
  if ([71, 73, 75, 77, 85, 86].includes(code)) return <Snowflake size={28} className="text-blue-300" />;
  if ([61, 63, 65, 66, 67, 80, 81, 82, 51, 53, 55, 56, 57].includes(code)) return <CloudRain size={28} className="text-blue-400" />;
  if ([45, 48].includes(code)) return <Wind size={28} className={isDarkMode ? 'text-slate-400' : 'text-slate-500'} />;
  return <Sun size={28} className="text-amber-400" />;
};

const formatRelativeLabel = (targetDate, today) => {
  const diffDays = Math.round((targetDate - today) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return '오늘';
  if (diffDays === 1) return '내일';
  if (diffDays === -1) return '어제';
  return `${Math.abs(diffDays)}일 ${diffDays > 0 ? '후' : '전'}`;
};

const formatTempValue = (value) => (typeof value === 'number' ? value.toFixed(1) : '--');

export default function WeatherSection({ currentDate, isDarkMode }) {
  const [weather, setWeather] = useState({ temp: '--', condition: 'Loading...', tip: '', code: 0, max: null, min: null });
  const [location, setLocation] = useState(null);
  const [isDefaultLoc, setIsDefaultLoc] = useState(false);
  const [locationLabel, setLocationLabel] = useState('My Location');
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [searchCity, setSearchCity] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');

  useEffect(() => {
    if (!navigator.geolocation) {
      useDefaultLocation();
      return;
    }

    let watchId;
    const successHandler = (pos) => {
      setLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      setIsDefaultLoc(false);
      setLocationLabel('현재 위치');
    };

    const errorHandler = () => {
      useDefaultLocation();
      if (watchId && navigator.geolocation.clearWatch) {
        navigator.geolocation.clearWatch(watchId);
      }
    };

    watchId = navigator.geolocation.watchPosition(successHandler, errorHandler, {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 60000
    });

    return () => {
      if (watchId && navigator.geolocation.clearWatch) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, []);

  const useDefaultLocation = () => {
    setLocation({ lat: 37.5665, lon: 126.9780 });
    setIsDefaultLoc(true);
    setLocationLabel('서울');
  };

  const handleSearchLocation = async () => {
    if (!searchCity.trim()) return;
    
    setSearchLoading(true);
    setSearchError('');
    
    try {
      const res = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(searchCity)}&count=5&language=ko&format=json`
      );
      const data = await res.json();
      
      if (!data.results || !data.results.length) {
        setSearchError('검색 결과가 없습니다. 다른 도시명을 입력해주세요.');
        setSearchLoading(false);
        return;
      }
      
      const match = data.results[0];
      setLocation({ lat: match.latitude, lon: match.longitude });
      setIsDefaultLoc(false);
      setLocationLabel(match.name || searchCity);
      setShowLocationModal(false);
      setSearchCity('');
    } catch (e) {
      console.error(e);
      setSearchError('검색 중 오류가 발생했습니다.');
    }
    setSearchLoading(false);
  };

  const getMockWeather = (dateStr) => {
    const month = new Date(dateStr).getMonth() + 1;
    let temp = 20;
    let code = 0;

    if (month === 12 || month <= 2) {
      temp = Math.floor(Math.random() * 5) - 5;
      code = Math.random() > 0.7 ? 71 : 0;
    } else if (month >= 6 && month <= 8) {
      temp = Math.floor(Math.random() * 5) + 25;
      code = Math.random() > 0.6 ? 61 : 0;
    }
    
    return { temp, code };
  };

  const generateSmartTip = (temp, code) => {
    if (code >= 71) return "눈이 오는 날씨네요. 따뜻한 음료와 함께 수분을 챙겨요 ❄️";
    if (code >= 51 && code <= 67) return "비 오는 날에도 수분 섭취는 필수! 실내에서 물 한 잔 ☔";
    if (temp <= 0) return "추운 날씨입니다. 따뜻한 물로 체온을 유지하세요 🥶";
    if (temp > 0 && temp <= 10) return "쌀쌀한 날씨! 갈증이 덜 나도 의식적으로 수분 섭취하세요 🍂";
    if (temp > 28) return "더운 날씨! 탈수 예방을 위해 물을 자주 마셔요 ☀️";
    return "활동하기 좋은 날씨예요. 틈틈이 수분을 보충하세요 🌤️";
  };

  useEffect(() => {
    if (!location) return;

    const fetchWeather = async () => {
      try {
        const targetDate = new Date(currentDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        targetDate.setHours(0, 0, 0, 0);

        let tempDisplay = '';
        let code = 0;
        let tipType = 'current';
        let representativeTemp = null;
        let rangeInfo = null;
        let currentTemp = null;

        const baseParams = `latitude=${location.lat}&longitude=${location.lon}&timezone=auto`;

        if (targetDate > today) {
          const url = `https://api.open-meteo.com/v1/forecast?${baseParams}&start_date=${currentDate}&end_date=${currentDate}&daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean,weathercode`;
          const res = await fetch(url);
          if (!res.ok) throw new Error("Forecast API Error");
          const data = await res.json();
          if (!data.daily || !data.daily.temperature_2m_max) throw new Error("No Forecast");
          
          const max = data.daily.temperature_2m_max[0];
          const min = data.daily.temperature_2m_min[0];
          const mean = data.daily.temperature_2m_mean ? data.daily.temperature_2m_mean[0] : (typeof max === 'number' && typeof min === 'number' ? (max + min) / 2 : null);
          tempDisplay = `${formatTempValue(max)}° / ${formatTempValue(min)}°`;
          code = data.daily.weathercode[0];
          representativeTemp = mean;
          rangeInfo = { max, min };
          tipType = 'future';
        } else if (targetDate.getTime() === today.getTime()) {
          const url = `https://api.open-meteo.com/v1/forecast?${baseParams}&start_date=${currentDate}&end_date=${currentDate}&daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean,weathercode&current_weather=true`;
          const res = await fetch(url);
          if (!res.ok) throw new Error("Current Weather API Error");
          const data = await res.json();
          const max = data.daily?.temperature_2m_max?.[0];
          const min = data.daily?.temperature_2m_min?.[0];
          const mean = data.daily?.temperature_2m_mean ? data.daily.temperature_2m_mean[0] : (typeof max === 'number' && typeof min === 'number' ? (max + min) / 2 : null);
          tempDisplay = `${formatTempValue(max)}° / ${formatTempValue(min)}°`;
          code = data.daily?.weathercode?.[0] ?? data.current_weather?.weathercode ?? 0;
          currentTemp = typeof data.current_weather?.temperature === 'number' ? data.current_weather.temperature : null;
          representativeTemp = typeof currentTemp === 'number' ? currentTemp : mean;
          rangeInfo = { max, min, current: currentTemp };
          tipType = 'current';
        } else {
          const url = `https://archive-api.open-meteo.com/v1/archive?${baseParams}&start_date=${currentDate}&end_date=${currentDate}&daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean,weathercode`;
          const res = await fetch(url);
          if (!res.ok) throw new Error("Archive API Error");
          const data = await res.json();
          if (!data.daily || !data.daily.temperature_2m_max) throw new Error("No Archive Data");
          
          const max = data.daily.temperature_2m_max[0];
          const min = data.daily.temperature_2m_min[0];
          const mean = data.daily.temperature_2m_mean ? data.daily.temperature_2m_mean[0] : (typeof max === 'number' && typeof min === 'number' ? (max + min) / 2 : null);
          tempDisplay = `${formatTempValue(max)}° / ${formatTempValue(min)}°`;
          code = data.daily.weathercode[0];
          representativeTemp = mean;
          rangeInfo = { max, min };
          tipType = 'past';
        }

        const condition = mapWeatherCodeToCondition(code);
        const tip = generateSmartTip(representativeTemp ?? 20, code);

        setWeather({ 
          temp: tempDisplay, 
          condition, 
          tip, 
          code,
          max: rangeInfo?.max,
          min: rangeInfo?.min,
          current: rangeInfo?.current
        });

      } catch (err) {
        console.warn("Using Mock Weather", err);
        const mock = getMockWeather(currentDate);
        
        setWeather({ 
          temp: `${mock.temp}°C`, 
          condition: mapWeatherCodeToCondition(mock.code), 
          tip: generateSmartTip(mock.temp, mock.code),
          code: mock.code,
          max: mock.temp + 3,
          min: mock.temp - 3
        });
      }
    };

    setWeather(prev => ({ ...prev, condition: 'Loading...' }));
    fetchWeather();

  }, [location, currentDate]);

  return (
    <>
      <div className={`p-5 rounded-3xl border shadow-sm transition-colors duration-300 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
        {/* 헤더 */}
        <div className="flex justify-between items-center mb-4">
          <h3 className={`text-sm font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Weather
          </h3>
          <button
            onClick={() => setShowLocationModal(true)}
            className={`text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 transition ${
              isDarkMode 
                ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' 
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <MapPin size={12} />
            {locationLabel}
          </button>
        </div>
        
        {/* 메인 날씨 카드 */}
        <div className={`p-4 rounded-2xl mb-3 ${isDarkMode ? 'bg-gradient-to-br from-slate-700/50 to-slate-800/50' : 'bg-gradient-to-br from-blue-50 to-slate-50'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl ${isDarkMode ? 'bg-slate-600/50' : 'bg-white shadow-sm'}`}>
                {getWeatherIcon(weather.code, isDarkMode)}
              </div>
              <div>
                <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                  {weather.current !== null && weather.current !== undefined 
                    ? `${weather.current.toFixed(0)}°` 
                    : weather.temp?.split('/')[0]?.trim() || '--°'
                  }
                </p>
                <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {weather.condition}
                </p>
              </div>
            </div>
            
            {/* 최고/최저 */}
            <div className="text-right">
              <div className="flex items-center gap-1 text-xs">
                <span className="text-red-400">▲</span>
                <span className={isDarkMode ? 'text-slate-300' : 'text-slate-600'}>
                  {weather.max !== null ? `${formatTempValue(weather.max)}°` : '--°'}
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs">
                <span className="text-blue-400">▼</span>
                <span className={isDarkMode ? 'text-slate-300' : 'text-slate-600'}>
                  {weather.min !== null ? `${formatTempValue(weather.min)}°` : '--°'}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        {/* 수분 섭취 팁 */}
        <div className={`flex items-start gap-2 p-3 rounded-xl text-xs leading-relaxed ${isDarkMode ? 'bg-blue-500/10 text-blue-300' : 'bg-blue-50 text-blue-700'}`}>
          <Droplets size={14} className="mt-0.5 flex-shrink-0" />
          <span>{weather.tip}</span>
        </div>
      </div>

      {/* 위치 변경 모달 */}
      {showLocationModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowLocationModal(false)}>
          <div 
            className={`w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden ${isDarkMode ? 'bg-slate-800' : 'bg-white'}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 모달 헤더 */}
            <div className={`p-6 ${isDarkMode ? 'bg-slate-700/50' : 'bg-slate-50'}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                  위치 설정
                </h3>
                <button 
                  onClick={() => setShowLocationModal(false)}
                  className={`p-2 rounded-full transition ${isDarkMode ? 'hover:bg-slate-600 text-slate-400' : 'hover:bg-slate-200 text-slate-500'}`}
                >
                  <X size={20} />
                </button>
              </div>
              
              {/* 검색 입력 */}
              <div className="relative">
                <input
                  type="text"
                  value={searchCity}
                  onChange={(e) => setSearchCity(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchLocation()}
                  placeholder="도시명 검색"
                  className={`w-full pl-10 pr-4 py-3 rounded-xl border-2 outline-none transition ${
                    isDarkMode 
                      ? 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500' 
                      : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-blue-500'
                  }`}
                />
                <Search size={18} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
              </div>
              
              {searchError && (
                <p className="text-red-500 text-xs mt-2">{searchError}</p>
              )}
            </div>
            
            {/* 빠른 선택 - 국내 도시만 */}
            <div className="p-6 max-h-72 overflow-y-auto">
              <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                도시 선택
              </p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { name: '서울', lat: 37.5665, lon: 126.9780 },
                  { name: '부산', lat: 35.1796, lon: 129.0756 },
                  { name: '대구', lat: 35.8714, lon: 128.6014 },
                  { name: '인천', lat: 37.4563, lon: 126.7052 },
                  { name: '대전', lat: 36.3504, lon: 127.3845 },
                  { name: '광주', lat: 35.1595, lon: 126.8526 },
                  { name: '울산', lat: 35.5384, lon: 129.3114 },
                  { name: '세종', lat: 36.4800, lon: 127.2890 },
                  { name: '수원', lat: 37.2636, lon: 127.0286 },
                  { name: '고양', lat: 37.6584, lon: 126.8320 },
                  { name: '용인', lat: 37.2411, lon: 127.1776 },
                  { name: '성남', lat: 37.4200, lon: 127.1267 },
                  { name: '청주', lat: 36.6424, lon: 127.4890 },
                  { name: '전주', lat: 35.8242, lon: 127.1480 },
                  { name: '천안', lat: 36.8151, lon: 127.1139 },
                  { name: '창원', lat: 35.2280, lon: 128.6811 },
                  { name: '포항', lat: 36.0190, lon: 129.3435 },
                  { name: '제주', lat: 33.4996, lon: 126.5312 },
                ].map((city) => (
                  <button
                    key={city.name}
                    onClick={() => {
                      setLocation({ lat: city.lat, lon: city.lon });
                      setLocationLabel(city.name);
                      setIsDefaultLoc(false);
                      setShowLocationModal(false);
                    }}
                    className={`p-2.5 rounded-xl text-xs font-medium transition ${
                      locationLabel === city.name
                        ? 'bg-blue-500 text-white'
                        : isDarkMode 
                          ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' 
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {city.name}
                  </button>
                ))}
              </div>
              
              <p className={`text-[10px] mt-4 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                💡 원하는 도시가 없다면 위 검색창에서 검색하세요
              </p>
              
              {/* 검색 버튼 */}
              <button
                onClick={handleSearchLocation}
                disabled={!searchCity.trim() || searchLoading}
                className="w-full mt-3 py-2.5 rounded-xl font-semibold bg-blue-500 text-white hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {searchLoading ? '검색 중...' : '도시 검색'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
