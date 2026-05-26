import { useAppSelector } from '../../hooks';
import { getError } from '../../store/selectors';

function ErrorMessage() {
  const error = useAppSelector(getError);

  if (!error) {
    return null;
  }

  return (
    <div className="error-message" role="alert">
      {error}
    </div>
  );
}

export { ErrorMessage };
