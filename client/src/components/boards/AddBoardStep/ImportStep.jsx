/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useCallback, useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Button } from 'semantic-ui-react';
import { FilePicker, Popup } from '../../../lib/custom-ui';

import FocalboardMappingStep from './FocalboardMappingStep';

import styles from './ImportStep.module.scss';

const ImportStep = React.memo(({ onSelect, onBack }) => {
  const [t] = useTranslation();

  // For Focalboard: we need an intermediate step to select property mappings
  const [focalboardFile, setFocalboardFile] = useState(null);

  const handleTrelloFileSelect = useCallback(
    (file) => {
      onSelect({
        type: 'trello',
        file,
      });
      onBack();
    },
    [onSelect, onBack],
  );

  const handleFocalboardFileSelect = useCallback((file) => {
    // Don't go back yet - show mapping step first
    setFocalboardFile(file);
  }, []);

  const handleFocalboardMappingSelect = useCallback(
    (importData) => {
      // importData includes: type, file, boardTitle, mapping
      onSelect(importData);
      // Go all the way back to AddBoardStep
      onBack();
    },
    [onSelect, onBack],
  );

  const handleFocalboardMappingBack = useCallback(() => {
    // Go back to file selection (within ImportStep)
    setFocalboardFile(null);
  }, []);

  // Show Focalboard mapping step if file is selected
  if (focalboardFile) {
    return (
      <FocalboardMappingStep
        file={focalboardFile}
        onSelect={handleFocalboardMappingSelect}
        onBack={handleFocalboardMappingBack}
      />
    );
  }

  return (
    <>
      <Popup.Header onBack={onBack}>
        {t('common.importBoard', {
          context: 'title',
        })}
      </Popup.Header>
      <Popup.Content>
        <FilePicker accept=".json" onSelect={handleTrelloFileSelect}>
          <Button fluid content={t('common.fromTrello')} icon="trello" className={styles.button} />
        </FilePicker>
        <FilePicker accept=".jsonl" onSelect={handleFocalboardFileSelect}>
          <Button fluid content={t('common.fromFocalboard')} icon="file" className={styles.button} />
        </FilePicker>
      </Popup.Content>
    </>
  );
});

ImportStep.propTypes = {
  onSelect: PropTypes.func.isRequired,
  onBack: PropTypes.func.isRequired,
};

export default ImportStep;
