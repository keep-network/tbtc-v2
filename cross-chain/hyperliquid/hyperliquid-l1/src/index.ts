import step1 from "./scripts/steps/step1.ts";
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  // The step argument (e.g., "step1", "step2", etc.) 
  // is passed after the '--' in the CLI command 
  // e.g. npm run deploy -- step1
  const stepArg = process.argv[2];

  if (!stepArg) {
    console.log('No step provided. Usage: npm run deploy -- step1');
    process.exit(1);
  }

  try {
    switch (stepArg) {
      case 'step1':
        await step1();
        break;
      default:
        console.log(`Unknown step: ${stepArg}`);
        process.exit(1);
    }
  } catch (error) {
    console.error('Error running deployment step:', error);
    process.exit(1);
  }
}

main();
