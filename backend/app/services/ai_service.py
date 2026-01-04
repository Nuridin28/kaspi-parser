from typing import Dict, List, Optional
from app.core.config import settings
from openai import OpenAI


class AIService:
    def __init__(self):
        api_key = settings.OPENAI_API_KEY
        print(f"DEBUG: OPENAI_API_KEY from settings: {api_key[:20] if api_key and len(api_key) > 20 else 'None or empty'}...")
        print(f"DEBUG: OPENAI_API_KEY length: {len(api_key) if api_key else 0}")
        print(f"DEBUG: OPENAI_API_KEY stripped: {api_key.strip() if api_key else 'None'}")
        
        if api_key and api_key.strip():
            try:
                self.client = OpenAI(api_key=api_key.strip())
                print(f"OpenAI client initialized successfully with model: {settings.OPENAI_MODEL}")
            except Exception as e:
                print(f"Failed to initialize OpenAI client: {str(e)}")
                self.client = None
        else:
            print("OPENAI_API_KEY is not set or empty")
            self.client = None
    
    def get_price_recommendation(
        self,
        product_name: str,
        user_price: float,
        statistics: Dict,
        position_estimate: Dict
    ) -> str:
        if not self.client:
            return "AI recommendations unavailable. Please configure OPENAI_API_KEY."
        
        prompt = f"""
        Ты - эксперт по ценообразованию и анализу рынка.
        
        Товар: {product_name}
        Текущая цена продавца: {user_price} тенге
        
        Статистика рынка:
        - Минимальная цена: {statistics.get('min_price', 'N/A')} тенге
        - Максимальная цена: {statistics.get('max_price', 'N/A')} тенге
        - Средняя цена: {statistics.get('avg_price', 'N/A')} тенге
        - Медианная цена: {statistics.get('median_price', 'N/A')} тенге
        
        Позиция продавца: {position_estimate.get('estimated_position', 'N/A')} из {position_estimate.get('total_sellers', 'N/A')}
        Процентиль: {position_estimate.get('percentile', 0):.1f}%
        
        Проанализируй ситуацию и дай рекомендацию:
        1. Оценка текущей позиции
        2. Рекомендация по цене для попадания в ТОП-5
        3. Анализ трендов
        4. Выявление аномалий
        
        Ответ должен быть кратким (2-3 предложения) и конкретным.
        """
        
        try:
            response = self.client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": "Ты эксперт по ценообразованию и анализу рынка."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=300
            )
            
            return response.choices[0].message.content
        except Exception as e:
            return f"Ошибка получения рекомендации: {str(e)}"
    
    def analyze_trends(self, price_history: List[Dict]) -> str:
        if not self.client or not price_history:
            return "Недостаточно данных для анализа трендов."
        
        history_text = "\n".join([
            f"{item['date']}: {item['price']} тенге"
            for item in price_history[-30:]
        ])
        
        prompt = f"""
        Проанализируй динамику цен за последний период:
        
        {history_text}
        
        Определи:
        1. Общий тренд (рост/падение/стабильность)
        2. Волатильность
        3. Прогноз на ближайшее время
        
        Ответ должен быть кратким (2-3 предложения).
        """
        
        try:
            response = self.client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": "Ты эксперт по анализу финансовых данных и трендов."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=200
            )
            
            return response.choices[0].message.content
        except Exception as e:
            return f"Ошибка анализа трендов: {str(e)}"

    def generate_advanced_insights(
        self,
        product_name: str,
        price_distribution: Dict,
        volatility: Dict,
        trend: Dict,
        demand_proxy: Dict,
        entry_barrier: Dict,
        optimal_price: Dict,
        anomalies: List[Dict],
        weighted_rank: Dict,
        dominant_sellers: List[Dict],
        user_price: Optional[float] = None
    ) -> str:
        if not self.client:
            print("AI client is None, cannot generate insights")
            return "AI insights unavailable. Please configure OPENAI_API_KEY."
        
        if not settings.OPENAI_API_KEY or settings.OPENAI_API_KEY.strip() == "":
            print("OPENAI_API_KEY is empty")
            return "AI insights unavailable. OPENAI_API_KEY is not configured."
        
        print(f"Generating AI insights for product: {product_name}")
        prompt = f"""
        Ты - эксперт по анализу рынка и ценообразованию. Проанализируй данные и дай стратегические инсайты.
        
        Товар: {product_name}
        Текущая цена продавца: {user_price if user_price else 'не указана'} тенге
        
        РАСПРЕДЕЛЕНИЕ ЦЕН:
        - Мин: {f"{price_distribution.get('min', 0):.2f}" if isinstance(price_distribution.get('min'), (int, float)) else 'N/A'} тенге
        - Медиана: {f"{price_distribution.get('median', 0):.2f}" if isinstance(price_distribution.get('median'), (int, float)) else 'N/A'} тенге
        - Макс: {f"{price_distribution.get('max', 0):.2f}" if isinstance(price_distribution.get('max'), (int, float)) else 'N/A'} тенге
        - P25: {f"{price_distribution.get('p25', 0):.2f}" if isinstance(price_distribution.get('p25'), (int, float)) else 'N/A'} тенге
        - P75: {f"{price_distribution.get('p75', 0):.2f}" if isinstance(price_distribution.get('p75'), (int, float)) else 'N/A'} тенге
        - IQR: {f"{price_distribution.get('iqr', 0):.2f}" if isinstance(price_distribution.get('iqr'), (int, float)) else 'N/A'} тенге
        
        ВОЛАТИЛЬНОСТЬ:
        - Коэффициент вариации: {f"{volatility.get('coefficient_of_variation', 0):.2f}%" if isinstance(volatility.get('coefficient_of_variation'), (int, float)) else 'N/A'}
        - Диапазон цен: {f"{volatility.get('price_range', 0):.2f}" if isinstance(volatility.get('price_range'), (int, float)) else 'N/A'} тенге
        
        ТРЕНД:
        - Направление: {trend.get('direction', 'N/A')}
        - Изменение: {f"{trend.get('change_percent', 0):.2f}%" if isinstance(trend.get('change_percent'), (int, float)) else 'N/A'}
        
        СПРОС:
        - Оценка спроса: {demand_proxy.get('demand_score', 0) * 100 if isinstance(demand_proxy.get('demand_score'), (int, float)) else 'N/A'}{'%' if isinstance(demand_proxy.get('demand_score'), (int, float)) else ''}
        - Количество продавцов: {demand_proxy.get('sellers_count', 'N/A')}
        - Уровень конкуренции: {demand_proxy.get('competition_level', 'N/A')}
        
        БАРЬЕР ВХОДА:
        - Уровень: {entry_barrier.get('level', 'N/A')}
        - Факторы: {', '.join(entry_barrier.get('factors', [])) if entry_barrier.get('factors') else 'Нет факторов'}
        
        ОПТИМАЛЬНАЯ ЦЕНА:
        - Рекомендуемая цена: {optimal_price.get('optimal_price', 'N/A')} тенге
        - Позиция: {optimal_price.get('estimated_position', 'N/A')}
        - Маржа: {f"{optimal_price.get('margin_percent', 0):.1f}%" if isinstance(optimal_price.get('margin_percent'), (int, float)) else 'N/A'}
        
        АНОМАЛИИ:
        {chr(10).join([f"- {a.get('message', '')}" for a in anomalies[:3]]) if anomalies else "Нет аномалий"}
        
        ДОМИНИРУЮЩИЕ ПРОДАВЦЫ:
        {chr(10).join([f"- {s.get('seller_name', '')}: частота в TOP-3 = {s.get('top3_frequency', 0)}" for s in dominant_sellers[:3]]) if dominant_sellers else "Нет данных"}
        
        Дай стратегические инсайты:
        1. Где находится ценовой "sweet spot" для этого товара?
        2. Почему дешевле не всегда лучше? (анализ взвешенного рейтинга)
        3. Когда стоит входить/не входить на рынок?
        4. Какой ценой можно выиграть конкурентов?
        5. Кто контролирует рынок и почему?
        6. Когда рынок "ломается" (аномалии)?
        7. Конкретные рекомендации по цене и стратегии
        
        Ответ должен быть структурированным, конкретным и давать реальные инсайты для принятия решений.
        """
        
        try:
            model = settings.OPENAI_MODEL
            print(f"Sending request to OpenAI API with model: {model}")
            print(f"API Key present: {bool(settings.OPENAI_API_KEY and settings.OPENAI_API_KEY.strip())}")
            
            try:
                response = self.client.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": "Ты эксперт по анализу рынка, ценообразованию и конкурентной стратегии. Твои инсайты помогают принимать решения, которые приносят деньги."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.8,
                    max_tokens=1000
                )
                print(f"OpenAI API response received. Choices count: {len(response.choices) if response.choices else 0}")
            except Exception as model_error:
                error_str = str(model_error)
                if "insufficient_quota" in error_str or "429" in error_str:
                    print(f"OpenAI quota exceeded. Error: {error_str}")
                    return "⚠️ Превышен лимит использования OpenAI API. Пожалуйста, проверьте баланс и настройки биллинга на https://platform.openai.com/account/billing"
                
                print(f"Error with model {model}, trying gpt-3.5-turbo: {error_str}")
                try:
                    model = "gpt-3.5-turbo"
                    response = self.client.chat.completions.create(
                        model=model,
                        messages=[
                            {"role": "system", "content": "Ты эксперт по анализу рынка, ценообразованию и конкурентной стратегии. Твои инсайты помогают принимать решения, которые приносят деньги."},
                            {"role": "user", "content": prompt}
                        ],
                        temperature=0.8,
                        max_tokens=1000
                    )
                    print(f"OpenAI API response received with fallback model. Choices count: {len(response.choices) if response.choices else 0}")
                except Exception as fallback_error:
                    error_str_fallback = str(fallback_error)
                    if "insufficient_quota" in error_str_fallback or "429" in error_str_fallback:
                        print(f"OpenAI quota exceeded even with fallback model. Error: {error_str_fallback}")
                        return "⚠️ Превышен лимит использования OpenAI API. Пожалуйста, проверьте баланс и настройки биллинга на https://platform.openai.com/account/billing"
                    raise fallback_error
            
            if response.choices and len(response.choices) > 0:
                content = response.choices[0].message.content
                print(f"AI insights generated successfully. Length: {len(content) if content else 0}")
                return content or "Не удалось получить ответ от AI"
            else:
                print("No choices in OpenAI response")
                return "Пустой ответ от AI"
        except Exception as e:
            import traceback
            error_str = str(e)
            if "insufficient_quota" in error_str or "429" in error_str:
                error_msg = "⚠️ Превышен лимит использования OpenAI API. Пожалуйста, проверьте баланс и настройки биллинга на https://platform.openai.com/account/billing"
            else:
                error_msg = f"Ошибка генерации инсайтов: {error_str}"
            print(f"ERROR in generate_advanced_insights: {error_msg}")
            return error_msg

    def generate_scenario_analysis(
        self,
        product_name: str,
        current_price: float,
        scenario_price: float,
        statistics: Dict,
        position_estimate: Dict
    ) -> str:
        if not self.client:
            return "AI scenario analysis unavailable."
        
        prompt = f"""
        Проанализируй сценарий изменения цены для товара {product_name}.
        
        Текущая цена: {current_price} тенге
        Предлагаемая цена: {scenario_price} тенге
        Изменение: {((scenario_price - current_price) / current_price * 100):.1f}%
        
        Статистика рынка:
        - Мин: {statistics.get('min_price', 'N/A')} тенге
        - Медиана: {statistics.get('median_price', 'N/A')} тенге
        - Макс: {statistics.get('max_price', 'N/A')} тенге
        
        Текущая позиция: {position_estimate.get('estimated_position', 'N/A')} из {position_estimate.get('total_sellers', 'N/A')}
        
        Оцени:
        1. Ожидаемую новую позицию
        2. Риски и возможности
        3. Влияние на маржу
        4. Конкурентную реакцию
        5. Рекомендацию (рекомендуется/не рекомендуется)
        
        Ответ должен быть кратким и конкретным.
        """
        
        try:
            response = self.client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": "Ты эксперт по анализу сценариев ценообразования."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=400
            )
            
            return response.choices[0].message.content
        except Exception as e:
            return f"Ошибка анализа сценария: {str(e)}"
