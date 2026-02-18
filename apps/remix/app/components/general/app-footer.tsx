import { Trans } from '@lingui/react/macro';

export const AppFooter = () => {
  return (
    <footer className="mt-auto border-t border-border bg-muted/30 py-3">
      <div className="mx-auto flex max-w-screen-xl flex-col items-center justify-center gap-1 px-4 text-center text-xs text-muted-foreground md:flex-row md:gap-4">
        <span>
          <Trans>Based on</Trans>{' '}
          <a
            href="https://github.com/documenso/documenso"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            Documenso
          </a>
          . <Trans>Source code</Trans>:{' '}
          <a
            href="https://github.com/mm-pinogy/documenso"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            github.com/mm-pinogy/documenso
          </a>
        </span>
        <span>
          <Trans>Licensed under</Trans>{' '}
          <a
            href="https://www.gnu.org/licenses/agpl-3.0.html"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            AGPL v3
          </a>
        </span>
      </div>
    </footer>
  );
};
