type StatusPanelProps = {
  error: string;
  loading: boolean;
  hasGameState: boolean;
};

export function StatusPanel({ error, loading, hasGameState }: StatusPanelProps) {
  return (
    <>
      {error && <div className="response error">{error}</div>}
      {loading && !hasGameState && !error && <div className="response loading">Загрузка...</div>}
    </>
  );
}
