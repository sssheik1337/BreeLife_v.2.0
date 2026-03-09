import uvicorn

from config import APP_HOST, APP_PORT
from app.application import create_app

app = create_app()


if __name__ == "__main__":
    # Запуск приложения через единый входной файл.раз
    uvicorn.run(app, host=APP_HOST, port=APP_PORT)
