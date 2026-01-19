/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Button, Checkbox, Dropdown, Form, Loader, Message } from 'semantic-ui-react';
import { Popup } from '../../../lib/custom-ui';

import api from '../../../api';

import styles from './FocalboardMappingStep.module.scss';

// Property types that can be used for each mapping
const COLUMN_TYPES = ['select'];
const LABEL_TYPES = ['select', 'multiSelect'];
const DUE_DATE_TYPES = ['date'];
const CUSTOM_FIELD_TYPES = ['text', 'url', 'number', 'email', 'phone', 'checkbox', 'date'];

const FocalboardMappingStep = React.memo(({ file, onSelect, onBack }) => {
  const [t] = useTranslation();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [previewData, setPreviewData] = useState(null);

  // User selections
  const [columnPropertyId, setColumnPropertyId] = useState(null);
  const [labelPropertyId, setLabelPropertyId] = useState(null);
  const [dueDatePropertyId, setDueDatePropertyId] = useState(null);
  const [customFieldPropertyIds, setCustomFieldPropertyIds] = useState([]);

  // Fetch preview data on mount
  useEffect(() => {
    let cancelled = false;

    const fetchPreview = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await api.previewFocalboardImport(file);

        if (cancelled) return;

        setPreviewData(data);

        // Auto-select column property from Kanban view
        const kanbanView = data.views.find((v) => v.type === 'board');
        if (kanbanView?.groupById) {
          setColumnPropertyId(kanbanView.groupById);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err.message || 'Failed to parse file');
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchPreview();

    return () => {
      cancelled = true;
    };
  }, [file]);

  // Filter properties by type for each dropdown
  const columnOptions = useMemo(() => {
    if (!previewData) return [];
    return previewData.properties
      .filter((p) => COLUMN_TYPES.includes(p.type))
      .map((p) => ({
        key: p.id,
        value: p.id,
        text: `${p.name} (${p.options?.length || 0} options)`,
      }));
  }, [previewData]);

  const labelOptions = useMemo(() => {
    if (!previewData) return [];
    return [
      { key: 'none', value: '', text: t('common.none') },
      ...previewData.properties
        .filter((p) => LABEL_TYPES.includes(p.type))
        .map((p) => ({
          key: p.id,
          value: p.id,
          text: `${p.name} (${p.options?.length || 0} options)`,
        })),
    ];
  }, [previewData, t]);

  const dueDateOptions = useMemo(() => {
    if (!previewData) return [];
    return [
      { key: 'none', value: '', text: t('common.none') },
      ...previewData.properties
        .filter((p) => DUE_DATE_TYPES.includes(p.type))
        .map((p) => ({
          key: p.id,
          value: p.id,
          text: p.name,
        })),
    ];
  }, [previewData, t]);

  const customFieldProperties = useMemo(() => {
    if (!previewData) return [];
    return previewData.properties.filter((p) => CUSTOM_FIELD_TYPES.includes(p.type));
  }, [previewData]);

  // Handlers
  const handleColumnChange = useCallback((_, { value }) => {
    setColumnPropertyId(value);
  }, []);

  const handleLabelChange = useCallback((_, { value }) => {
    setLabelPropertyId(value);
  }, []);

  const handleDueDateChange = useCallback((_, { value }) => {
    setDueDatePropertyId(value);
  }, []);

  const handleCustomFieldToggle = useCallback((propertyId) => {
    setCustomFieldPropertyIds((prev) =>
      prev.includes(propertyId)
        ? prev.filter((id) => id !== propertyId)
        : [...prev, propertyId]
    );
  }, []);

  const handleSelectAllCustomFields = useCallback(() => {
    setCustomFieldPropertyIds(customFieldProperties.map((p) => p.id));
  }, [customFieldProperties]);

  const handleDeselectAllCustomFields = useCallback(() => {
    setCustomFieldPropertyIds([]);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!columnPropertyId) return;

    const importData = {
      type: 'focalboard',
      file,
      mapping: {
        columnPropertyId,
        labelPropertyId: labelPropertyId || undefined,
        dueDatePropertyId: dueDatePropertyId || undefined,
        customFieldPropertyIds: customFieldPropertyIds.length > 0 ? customFieldPropertyIds : undefined,
      },
    };
    console.log('FocalboardMappingStep sending:', importData);
    onSelect(importData);
  }, [file, columnPropertyId, labelPropertyId, dueDatePropertyId, customFieldPropertyIds, onSelect, onBack]);

  // Loading state
  if (isLoading) {
    return (
      <>
        <Popup.Header onBack={onBack}>
          {t('common.focalboardImport', { context: 'title' })}
        </Popup.Header>
        <Popup.Content>
          <div className={styles.loaderWrapper}>
            <Loader active inline="centered" />
            <p>{t('common.parsingFile')}</p>
          </div>
        </Popup.Content>
      </>
    );
  }

  // Error state
  if (error) {
    return (
      <>
        <Popup.Header onBack={onBack}>
          {t('common.focalboardImport', { context: 'title' })}
        </Popup.Header>
        <Popup.Content>
          <Message negative>
            <Message.Header>{t('common.error')}</Message.Header>
            <p>{error}</p>
          </Message>
        </Popup.Content>
      </>
    );
  }

  return (
    <>
      <Popup.Header onBack={onBack}>
        {t('common.focalboardImport', { context: 'title' })}
      </Popup.Header>
      <Popup.Content>
        <div className={styles.boardInfo}>
          <strong>{previewData.board.title}</strong>
          <span className={styles.stats}>
            {t('common.cardsCount', { count: previewData.stats.totalCards })}
          </span>
        </div>

        <Form onSubmit={handleSubmit}>
          {/* Columns (required) */}
          <div className={styles.section}>
            <div className={styles.label}>
              {t('common.columns')} <span className={styles.required}>*</span>
            </div>
            <Dropdown
              fluid
              selection
              options={columnOptions}
              value={columnPropertyId}
              placeholder={t('common.selectProperty')}
              onChange={handleColumnChange}
            />
          </div>

          {/* Labels (optional) */}
          <div className={styles.section}>
            <div className={styles.label}>{t('common.labels')}</div>
            <Dropdown
              fluid
              selection
              options={labelOptions}
              value={labelPropertyId || ''}
              placeholder={t('common.selectProperty')}
              onChange={handleLabelChange}
            />
          </div>

          {/* Due Date (optional) */}
          <div className={styles.section}>
            <div className={styles.label}>{t('common.byDueDate')}</div>
            <Dropdown
              fluid
              selection
              options={dueDateOptions}
              value={dueDatePropertyId || ''}
              placeholder={t('common.selectProperty')}
              onChange={handleDueDateChange}
            />
          </div>

          {/* Custom Fields (optional, multiple) */}
          {customFieldProperties.length > 0 && (
            <div className={styles.section}>
              <div className={styles.labelWithActions}>
                <span className={styles.label}>{t('common.customFields_title')}</span>
                <div className={styles.actions}>
                  <Button
                    type="button"
                    className={styles.actionButton}
                    onClick={handleSelectAllCustomFields}
                  >
                    {t('action.selectAll')}
                  </Button>
                  <Button
                    type="button"
                    className={styles.actionButton}
                    onClick={handleDeselectAllCustomFields}
                  >
                    {t('action.deselectAll')}
                  </Button>
                </div>
              </div>
              <div className={styles.checkboxList}>
                {customFieldProperties.map((property) => (
                  <div key={property.id} className={styles.checkboxItem}>
                    <Checkbox
                      checked={customFieldPropertyIds.includes(property.id)}
                      label={
                        <label className={styles.checkboxLabel}>
                          <span>{property.name}</span>
                          <span className={styles.propertyType}>{property.type}</span>
                        </label>
                      }
                      onChange={() => handleCustomFieldToggle(property.id)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button
            positive
            fluid
            content={t('action.import')}
            disabled={!columnPropertyId}
            className={styles.submitButton}
          />
        </Form>
      </Popup.Content>
    </>
  );
});

FocalboardMappingStep.propTypes = {
  file: PropTypes.instanceOf(File).isRequired,
  onSelect: PropTypes.func.isRequired,
  onBack: PropTypes.func.isRequired,
};

export default FocalboardMappingStep;
