from datetime import datetime, timedelta


class PaymentService:
    """Заглушка сервиса платежей и пробного периода."""

    def __init__(self) -> None:
        self._trial_starts = {}
        self._subscriptions = {}

    def is_trial_active(self, user_id: str) -> bool:
        """Проверяет активность пробного периода."""
        start_time = self._trial_starts.get(user_id)
        if not start_time:
            return False
        return datetime.utcnow() < start_time + timedelta(days=7)

    def get_subscription_status(self, user_id: str) -> str:
        """Возвращает статус подписки."""
        if self.is_trial_active(user_id):
            return "trial"
        return self._subscriptions.get(user_id, "inactive")

    def start_trial(self, user_id: str) -> None:
        """Запускает пробный период для пользователя."""
        self._trial_starts[user_id] = datetime.utcnow()

    def create_payment_stub(self) -> dict:
        """Создает заглушку платежа."""
        # Здесь будет интеграция с Т-Банк / Ю-Касса.
        return {
            "payment_id": "stub_payment",
            "status": "pending",
            "created_at": datetime.utcnow().isoformat(),
        }
