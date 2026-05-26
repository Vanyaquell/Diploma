import { Link } from 'react-router-dom';

import { AppRoute } from '../../const';

function NotFoundPage() {
  return (
    <main className="page page--centered">
      <h1>404</h1>
      <p>Страница не найдена.</p>
      <Link className="button" to={AppRoute.Main}>Перейти к прогнозу</Link>
    </main>
  );
}

export { NotFoundPage };
