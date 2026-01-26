import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  console.log('CORS enabled for origin:', frontendUrl);
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) {
        return callback(null, true);
      }
      // Allow localhost on any port for development
      if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
        return callback(null, true);
      }
      // Allow the configured frontend URL
      if (origin === frontendUrl) {
        return callback(null, true);
      }
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Branch-Id'],
    exposedHeaders: ['Content-Type', 'Authorization'],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const port = process.env.PORT || 3001;
  
  // Try to listen on the port, with better error handling
  try {
    await app.listen(port);
    console.log(`Application is running on: http://localhost:${port}`);
  } catch (error: any) {
    if (error.code === 'EADDRINUSE') {
      console.error(
        `\n⚠️  Port ${port} is already in use.\n` +
        `   Run "npm run kill:port" to free the port, or\n` +
        `   The server will attempt to close gracefully on next restart.\n`,
      );
      // Give a moment for the old process to close, then exit
      setTimeout(() => {
        process.exit(1);
      }, 1000);
      return;
    }
    throw error;
  }

  // Graceful shutdown handling
  const gracefulShutdown = async (signal: string) => {
    console.log(`\n${signal} received. Starting graceful shutdown...`);
    try {
      // Close the app with a timeout to prevent hanging
      await Promise.race([
        app.close(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Shutdown timeout')), 5000),
        ),
      ]);
      console.log('Application closed successfully.');
      process.exit(0);
    } catch (error: any) {
      if (error.message === 'Shutdown timeout') {
        console.warn('Shutdown timeout reached, forcing exit...');
      } else {
        console.error('Error during shutdown:', error);
      }
      process.exit(1);
    }
  };

  // Handle termination signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    gracefulShutdown('uncaughtException');
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('unhandledRejection');
  });
}

bootstrap();

