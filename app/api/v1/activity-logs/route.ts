// api/v1/activity-logs/route.ts
// V1 standardized activity logs endpoint.

import { requireRole } from '../../../../lib/auth';
import { activityLogData } from '../../../../lib/data';
import { ok, badRequest, notFound, fromError } from '../../../../lib/api-response';

export async function GET(request: Request) {
  try {
    requireRole(request, ['admin']);
    const logs = activityLogData.getAll().sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    return ok({ logs });
  } catch (error) {
    return fromError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    requireRole(request, ['admin']);
    const { searchParams } = new URL(request.url);
    const deleteAll = searchParams.get('deleteAll');
    const id = searchParams.get('id');

    if (deleteAll === 'true') {
      activityLogData.clearAll();
      return ok({ message: 'Todos os logs foram removidos.' });
    }

    if (id) {
      const deleted = activityLogData.deleteById(id);
      if (!deleted) return notFound('Log não encontrado.');
      return ok({ message: 'Log removido com sucesso.' });
    }

    return badRequest('Forneça um id ou deleteAll=true.');
  } catch (error) {
    return fromError(error);
  }
}
