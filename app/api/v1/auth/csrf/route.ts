import { generateCsrfToken } from '../../../../lib/csrf';
import { ok, fromError } from '../../../../lib/api-response';

export async function GET() {
  try {
    const csrfToken = generateCsrfToken();
    return ok({ csrfToken });
  } catch (error) {
    return fromError(error);
  }
}
