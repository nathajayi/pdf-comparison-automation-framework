import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: [
    ['html', { open: 'never' }],
    ['list']
  ],

  timeout: 30_000,
  expect: {
    timeout: 5_000
  },

  use: {
    
    actionTimeout: 10_000,
    navigationTimeout: 30_000,

    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: process.env.CI ? 'retain-on-failure' : 'off',

    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] }
    }
  ],

  outputDir: 'test-results'
});

 /*
+----------------------------------------+
|        Authored by:                    |
|            NATHANIEL AJAYI             |
+----------------------------------------+
For portfolio review only; no permission to reuse/redistribute without written approval.
   _  __     __  __             _     __  ___     _           _ 
  / |/ /__ _/ /_/ /  ___ ____  (_)__ / / / _ |   (_)__ ___ __(_)
 /    / _ `/ __/ _ \/ _ `/ _ \/ / -_) / / __ |  / / _ `/ // / / 
/_/|_/\_,_/\__/_//_/\_,_/_//_/_/\__/_/ /_/ |_|_/ /\_,_/\_, /_/  
                                            |___/     /___/     
*/
