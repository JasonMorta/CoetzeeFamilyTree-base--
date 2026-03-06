import React, { memo, useMemo, useState, useCallback, useEffect } from 'react';
import { Form, Input, InputPicker, TagPicker, Checkbox, Divider, Button } from 'rsuite';
import styles from './PersonFields.module.css';

function fieldHidden(person, key) {
  return !!(person.hiddenFields && person.hiddenFields[key]);
}

function buildSavedPeopleOptions(savedPeople = []) {
  return (savedPeople || [])
    .filter((p) => (p?.fullName || '').trim().length > 0)
    .map((p) => ({
      label: p.fullName,
      value: p.fullName,
      person: p
    }));
}

function renderPersonOption(label, item) {
  const person = item?.person;
  return (
    <div className={styles.userOption}>
      <div className={styles.userOptionName}>{label}</div>
      <div className={styles.userOptionMeta}>{person?.nickname ? person.nickname : ''}</div>
    </div>
  );
}

function FieldRow({ label, hidden, onToggleHidden, children }) {
  return (
    <div className={styles.fieldRow}>
      <div className={styles.fieldHeader}>
        <Form.ControlLabel>{label}</Form.ControlLabel>
        <Checkbox checked={hidden} onChange={(_, checked) => onToggleHidden(checked)} className={styles.hideCheck}>
          Hide
        </Checkbox>
      </div>
      {children}
    </div>
  );
}

function buildHybridList(savedPeopleOptions, keyword, selected = []) {
  const kw = (keyword || '').trim().toLowerCase();
  const filtered = !kw ? savedPeopleOptions : savedPeopleOptions.filter((o) => o.value.toLowerCase().includes(kw));
  const base = filtered.slice(0, 15).map((o) => ({ label: o.label, value: o.value, person: o.person }));

  // Ensure selected values are always present so pickers can display them even if not in top 15
  const selectedSet = new Set((selected || []).filter(Boolean));
  selectedSet.forEach((val) => {
    if (!base.some((o) => o.value === val)) base.unshift({ label: val, value: val });
  });

  return base;
}

function normalizeRelSingle(value) {
  if (!value) return { name: '', photo: '' };
  if (typeof value === 'string') return { name: value, photo: '' };
  return { name: value?.name || '', photo: value?.photo || '' };
}

function normalizeRelMulti(value) {
  const arr = Array.isArray(value) ? value : [];
  return arr
    .map((v) => {
      if (!v) return null;
      if (typeof v === 'string') return { name: v, photo: '' };
      return { name: v?.name || '', photo: v?.photo || '' };
    })
    .filter(Boolean)
    .filter((v) => String(v.name || '').trim().length > 0);
}

function StandardPersonFields({ person, setPerson, savedPeople = [], onAutofillPerson, onSaveSection, onStatusChange }) {
  const [saveStatus, setSaveStatus] = useState({ personal: 'idle', about: 'idle', relationships: 'idle' });
  useEffect(() => {
    const next = { personal: 'idle', about: 'idle', relationships: 'idle' };
    setSaveStatus(next);
    onStatusChange?.(next);
  }, [onStatusChange, person?.id]);
  const markDirty = useCallback((section) => {
    setSaveStatus((prev) => {
      const next = (prev?.[section] === 'dirty') ? (prev || {}) : { ...(prev || {}), [section]: 'dirty' };
      onStatusChange?.(next);
      return next;
    });
  }, [onStatusChange]);
  const markSaved = useCallback((section) => {
    setSaveStatus((prev) => {
      const next = { ...(prev || {}), [section]: 'saved' };
      onStatusChange?.(next);
      return next;
    });
    window.setTimeout(() => {
      setSaveStatus((prev) => {
        const next = { ...(prev || {}), [section]: 'idle' };
        onStatusChange?.(next);
        return next;
      });
    }, 1200);
  }, [onStatusChange]);
  const sectionBtnClass = useCallback((section) => {
    const s = saveStatus?.[section] || 'idle';
    if (s === 'dirty') return styles.saveBtnDirty;
    if (s === 'saved') return styles.saveBtnSaved;
    return '';
  }, [saveStatus]);
  const sectionBtnLabel = useCallback((section, base) => {
    return (saveStatus?.[section] === 'saved') ? 'Saved ✓' : base;
  }, [saveStatus]);
  const [nameSearch, setNameSearch] = useState('');

  const [fatherSearch, setFatherSearch] = useState('');
  const [motherSearch, setMotherSearch] = useState('');
  const [childrenSearch, setChildrenSearch] = useState('');
  const [siblingsSearch, setSiblingsSearch] = useState('');

  const [girlfriendsSearch, setGirlfriendsSearch] = useState('');
  const [boyfriendsSearch, setBoyfriendsSearch] = useState('');
  const [husbandsSearch, setHusbandsSearch] = useState('');
  const [wivesSearch, setWivesSearch] = useState('');

  const [stepFathersSearch, setStepFathersSearch] = useState('');
  const [stepMothersSearch, setStepMothersSearch] = useState('');
  const [fosterParentsSearch, setFosterParentsSearch] = useState('');
  const [fosterChildrenSearch, setFosterChildrenSearch] = useState('');
  const [adoptiveParentsSearch, setAdoptiveParentsSearch] = useState('');
  const [adoptedChildrenSearch, setAdoptedChildrenSearch] = useState('');

  const setPersonPersonal = useCallback((updater) => { markDirty('personal'); setPerson(updater); }, [markDirty, setPerson]);
  const setPersonAbout = useCallback((updater) => { markDirty('about'); setPerson(updater); }, [markDirty, setPerson]);
  const setPersonRelationships = useCallback((updater) => { markDirty('relationships'); setPerson(updater); }, [markDirty, setPerson]);

  const savedPeopleOptions = useMemo(() => buildSavedPeopleOptions(savedPeople), [savedPeople]);
  const savedPeopleMap = useMemo(() => {
    const map = new Map();
    (savedPeople || []).forEach((p) => {
      const key = String(p?.fullName || '').trim().toLowerCase();
      if (key) map.set(key, p);
    });
    return map;
  }, [savedPeople]);

  const currentFather = useMemo(() => normalizeRelSingle(person.father), [person.father]);
  const currentMother = useMemo(() => normalizeRelSingle(person.mother), [person.mother]);

  const childrenArr = useMemo(() => normalizeRelMulti(person.children), [person.children]);
  const siblingsArr = useMemo(() => normalizeRelMulti(person.siblings), [person.siblings]);
  const girlfriendsArr = useMemo(() => normalizeRelMulti(person.girlfriends), [person.girlfriends]);
  const boyfriendsArr = useMemo(() => normalizeRelMulti(person.boyfriends), [person.boyfriends]);
  const husbandsArr = useMemo(() => normalizeRelMulti(person.husbands), [person.husbands]);
  const wivesArr = useMemo(() => normalizeRelMulti(person.wives), [person.wives]);

  const stepFathersArr = useMemo(() => normalizeRelMulti(person.stepFathers), [person.stepFathers]);
  const stepMothersArr = useMemo(() => normalizeRelMulti(person.stepMothers), [person.stepMothers]);
  const fosterParentsArr = useMemo(() => normalizeRelMulti(person.fosterParents), [person.fosterParents]);
  const fosterChildrenArr = useMemo(() => normalizeRelMulti(person.fosterChildren), [person.fosterChildren]);
  const adoptiveParentsArr = useMemo(() => normalizeRelMulti(person.adoptiveParents), [person.adoptiveParents]);
  const adoptedChildrenArr = useMemo(() => normalizeRelMulti(person.adoptedChildren), [person.adoptedChildren]);

  const updateField = useCallback((section, field, value) => {
    markDirty(section);
    setPerson((prev) => ({ ...(prev || {}), [field]: value }));
  }, [markDirty, setPerson]);

  const updateHiddenField = useCallback((section, field, hidden) => {
    markDirty(section);
    setPerson((prev) => {
      const current = prev || {};
      const nextHidden = { ...(current.hiddenFields || {}), [field]: hidden };
      return { ...current, hiddenFields: nextHidden };
    });
  }, [markDirty, setPerson]);

  const handleNameSelect = useCallback((value, item) => {
    if (item?.person && onAutofillPerson) {
      markDirty('personal');
      onAutofillPerson(person.id, item.person);
      return;
    }
    updateField('personal', 'fullName', value || '');
  }, [onAutofillPerson, person.id, updateField]);

  const stillAlive = Boolean(person.stillAlive);

  const getSavedPhoto = useCallback((name) => {
    const key = String(name || '').trim().toLowerCase();
    const p = savedPeopleMap.get(key);
    return p?.photo || '';
  }, [savedPeopleMap]);

  const setRelSingle = useCallback((field, name) => {
    const prev = normalizeRelSingle(person[field]);
    const nextName = String(name || '');
    const nextPhoto = prev.photo || getSavedPhoto(nextName) || '';
    updateField('relationships', field, { name: nextName, photo: nextPhoto });
  }, [getSavedPhoto, person, updateField]);

  const setRelSinglePhoto = useCallback((field, photo) => {
    const prev = normalizeRelSingle(person[field]);
    updateField('relationships', field, { ...prev, photo: String(photo || '') });
  }, [person, updateField]);

  const setRelMulti = useCallback((field, names) => {
    const nextNames = Array.isArray(names) ? names : [];
    const prevArr = normalizeRelMulti(person[field]);
    const prevMap = new Map(prevArr.map((x) => [String(x.name).toLowerCase(), x]));
    const nextArr = nextNames
      .filter(Boolean)
      .map((nm) => {
        const key = String(nm).toLowerCase();
        const existing = prevMap.get(key);
        return {
          name: nm,
          photo: existing?.photo || getSavedPhoto(nm) || ''
        };
      });
    updateField('relationships', field, nextArr);
  }, [getSavedPhoto, person, updateField]);

  const setRelMultiPhoto = useCallback((field, name, photo) => {
    const arr = normalizeRelMulti(person[field]);
    const next = arr.map((x) => (String(x.name).toLowerCase() === String(name).toLowerCase() ? { ...x, photo: String(photo || '') } : x));
    updateField('relationships', field, next);
  }, [person, updateField]);

  // Picker data lists (max 15 + ensure selection is visible)
  const nameOptions = useMemo(() => buildHybridList(savedPeopleOptions, nameSearch, [person.fullName || '']), [savedPeopleOptions, nameSearch, person.fullName]);

  const fatherOptions = useMemo(() => buildHybridList(savedPeopleOptions, fatherSearch, [currentFather.name]), [savedPeopleOptions, fatherSearch, currentFather.name]);
  const motherOptions = useMemo(() => buildHybridList(savedPeopleOptions, motherSearch, [currentMother.name]), [savedPeopleOptions, motherSearch, currentMother.name]);

  const childrenOptions = useMemo(() => buildHybridList(savedPeopleOptions, childrenSearch, childrenArr.map((c) => c.name)), [savedPeopleOptions, childrenSearch, childrenArr]);
  const siblingsOptions = useMemo(() => buildHybridList(savedPeopleOptions, siblingsSearch, siblingsArr.map((c) => c.name)), [savedPeopleOptions, siblingsSearch, siblingsArr]);
  const girlfriendsOptions = useMemo(() => buildHybridList(savedPeopleOptions, girlfriendsSearch, girlfriendsArr.map((c) => c.name)), [savedPeopleOptions, girlfriendsSearch, girlfriendsArr]);
  const boyfriendsOptions = useMemo(() => buildHybridList(savedPeopleOptions, boyfriendsSearch, boyfriendsArr.map((c) => c.name)), [savedPeopleOptions, boyfriendsSearch, boyfriendsArr]);
  const husbandsOptions = useMemo(() => buildHybridList(savedPeopleOptions, husbandsSearch, husbandsArr.map((c) => c.name)), [savedPeopleOptions, husbandsSearch, husbandsArr]);
  const wivesOptions = useMemo(() => buildHybridList(savedPeopleOptions, wivesSearch, wivesArr.map((c) => c.name)), [savedPeopleOptions, wivesSearch, wivesArr]);

  const stepFathersOptions = useMemo(() => buildHybridList(savedPeopleOptions, stepFathersSearch, stepFathersArr.map((c) => c.name)), [savedPeopleOptions, stepFathersSearch, stepFathersArr]);
  const stepMothersOptions = useMemo(() => buildHybridList(savedPeopleOptions, stepMothersSearch, stepMothersArr.map((c) => c.name)), [savedPeopleOptions, stepMothersSearch, stepMothersArr]);
  const fosterParentsOptions = useMemo(() => buildHybridList(savedPeopleOptions, fosterParentsSearch, fosterParentsArr.map((c) => c.name)), [savedPeopleOptions, fosterParentsSearch, fosterParentsArr]);
  const fosterChildrenOptions = useMemo(() => buildHybridList(savedPeopleOptions, fosterChildrenSearch, fosterChildrenArr.map((c) => c.name)), [savedPeopleOptions, fosterChildrenSearch, fosterChildrenArr]);
  const adoptiveParentsOptions = useMemo(() => buildHybridList(savedPeopleOptions, adoptiveParentsSearch, adoptiveParentsArr.map((c) => c.name)), [savedPeopleOptions, adoptiveParentsSearch, adoptiveParentsArr]);
  const adoptedChildrenOptions = useMemo(() => buildHybridList(savedPeopleOptions, adoptedChildrenSearch, adoptedChildrenArr.map((c) => c.name)), [savedPeopleOptions, adoptedChildrenSearch, adoptedChildrenArr]);

  const MultiRel = ({ label, field, options, searchSetter, valueArr, searchValue }) => (
    <FieldRow
      label={label}
      hidden={fieldHidden(person, field)}
      onToggleHidden={(checked) => updateHiddenField('relationships', field, checked)}
    >
      <TagPicker
        data={options}
        value={valueArr.map((x) => x.name)}
        onChange={(val) => setRelMulti(field, val)}
        onSearch={(kw) => searchSetter(kw)}
        placeholder="Type or select"
        searchable
        cleanable
        creatable
        block
        renderMenuItem={renderPersonOption}
      />
      {valueArr.length ? (
        <div className={styles.relationshipPhotos}>
          {valueArr.map((x) => (
            <div key={`${field}-${x.name}`} className={styles.relationshipPhotoRow}>
              <div className={styles.relationshipPhotoName}>{x.name}</div>
              <Input
                value={x.photo || ''}
                onChange={(val) => setRelMultiPhoto(field, x.name, val)}
                placeholder="Image URL (optional)"
              />
            </div>
          ))}
        </div>
      ) : null}
    </FieldRow>
  );

  return (
    <div className={styles.standardPersonWrap}>
      <Divider className={styles.sectionDivider}>Personal details</Divider>

      <Form fluid>
        <FieldRow
          label="Name & Surname"
          hidden={fieldHidden(person, 'fullName')}
          onToggleHidden={(checked) => updateHiddenField('personal', 'fullName', checked)}
        >
          <InputPicker
            data={nameOptions}
            value={person.fullName || ''}
            onChange={(val) => updateField('personal', 'fullName', val || '')}
            onSelect={handleNameSelect}
            onSearch={(kw) => setNameSearch(kw)}
            placeholder="Type a name or select an existing person"
            searchable
            creatable
            renderMenuItem={renderPersonOption}
            cleanable
            block
          />
        </FieldRow>

        <FieldRow
          label="Nickname"
          hidden={fieldHidden(person, 'nickname')}
          onToggleHidden={(checked) => updateHiddenField('personal', 'nickname', checked)}
        >
          <Input value={person.nickname || ''} onChange={(val) => updateField('personal', 'nickname', val)} placeholder="Optional" />
        </FieldRow>

        <FieldRow
          label="Image URL"
          hidden={fieldHidden(person, 'photo')}
          onToggleHidden={(checked) => updateHiddenField('personal', 'photo', checked)}
        >
          <Input value={person.photo || ''} onChange={(val) => updateField('personal', 'photo', val)} placeholder="Paste an image URL" />
        </FieldRow>

        <FieldRow
          label="Title / Prefix"
          hidden={fieldHidden(person, 'prefix')}
          onToggleHidden={(checked) => updateHiddenField('personal', 'prefix', checked)}
        >
          <Input value={person.prefix || ''} onChange={(val) => updateField('personal', 'prefix', val)} placeholder="e.g., Mr, Mrs, Dr" />
        </FieldRow>

        <FieldRow
          label="Maiden name / Birth surname"
          hidden={fieldHidden(person, 'maidenName')}
          onToggleHidden={(checked) => updateHiddenField('personal', 'maidenName', checked)}
        >
          <Input value={person.maidenName || ''} onChange={(val) => updateField('personal', 'maidenName', val)} placeholder="Optional" />
        </FieldRow>

        <Button
          appearance="primary"
          className={sectionBtnClass('personal')}
          block
          onClick={() => {
            onSaveSection?.({
              fullName: person.fullName,
              nickname: person.nickname,
              photo: person.photo,
              prefix: person.prefix,
              maidenName: person.maidenName,
              hiddenFields: person.hiddenFields
            });
            markSaved('personal');
          }}
        >
          {sectionBtnLabel('personal','Save personal details')}
        </Button>

        <Divider className={styles.sectionDivider}>About this person</Divider>

        <FieldRow
          label="Birth date"
          hidden={fieldHidden(person, 'birthDate')}
          onToggleHidden={(checked) => updateHiddenField('about', 'birthDate', checked)}
        >
          <Input value={person.birthDate || ''} onChange={(val) => updateField('about', 'birthDate', val)} placeholder="YYYY-MM-DD" />
        </FieldRow>

        <FieldRow
          label="Birth place"
          hidden={fieldHidden(person, 'birthPlace')}
          onToggleHidden={(checked) => updateHiddenField('about', 'birthPlace', checked)}
        >
          <Input value={person.birthPlace || ''} onChange={(val) => updateField('about', 'birthPlace', val)} placeholder="Town / City / Country" />
        </FieldRow>

        <div className={styles.inlineChecks}>
          <Checkbox checked={stillAlive} onChange={(_, checked) => updateField('about', 'stillAlive', checked)}>
            Still alive
          </Checkbox>
        </div>

        {!stillAlive && (
          <>
            <FieldRow
              label="Death date"
              hidden={fieldHidden(person, 'deathDate')}
              onToggleHidden={(checked) => updateHiddenField('about', 'deathDate', checked)}
            >
              <Input value={person.deathDate || ''} onChange={(val) => updateField('about', 'deathDate', val)} placeholder="YYYY-MM-DD" />
            </FieldRow>

            <FieldRow
              label="Death place"
              hidden={fieldHidden(person, 'deathPlace')}
              onToggleHidden={(checked) => updateHiddenField('about', 'deathPlace', checked)}
            >
              <Input value={person.deathPlace || ''} onChange={(val) => updateField('about', 'deathPlace', val)} placeholder="Town / City / Country" />
            </FieldRow>
          </>
        )}

        <FieldRow
          label="Occupation"
          hidden={fieldHidden(person, 'occupation')}
          onToggleHidden={(checked) => updateHiddenField('about', 'occupation', checked)}
        >
          <Input value={person.occupation || ''} onChange={(val) => updateField('about', 'occupation', val)} placeholder="Optional" />
        </FieldRow>

        <FieldRow
          label="Address"
          hidden={fieldHidden(person, 'address')}
          onToggleHidden={(checked) => updateHiddenField('about', 'address', checked)}
        >
          <Input as="textarea" rows={3} value={person.address || ''} onChange={(val) => updateField('about', 'address', val)} placeholder="Enter an address (multi-line)" />
        </FieldRow>

        <FieldRow
          label="Contact number"
          hidden={fieldHidden(person, 'contactNumber')}
          onToggleHidden={(checked) => updateHiddenField('about', 'contactNumber', checked)}
        >
          <Input value={person.contactNumber || ''} onChange={(val) => updateField('about', 'contactNumber', val)} placeholder="Optional" />
        </FieldRow>

        <FieldRow
          label="More information about this person"
          hidden={fieldHidden(person, 'moreInfo')}
          onToggleHidden={(checked) => updateHiddenField('about', 'moreInfo', checked)}
        >
          <Input as="textarea" rows={4} value={person.moreInfo || ''} onChange={(val) => updateField('about', 'moreInfo', val)} placeholder="No information yet" />
        </FieldRow>

        <Button
          appearance="primary"
          className={sectionBtnClass('about')}
          block
          onClick={() => {
            onSaveSection?.({
              birthDate: person.birthDate,
              birthPlace: person.birthPlace,
              stillAlive: Boolean(person.stillAlive),
              deathDate: person.deathDate,
              deathPlace: person.deathPlace,
              occupation: person.occupation,
              address: person.address,
              contactNumber: person.contactNumber,
              moreInfo: person.moreInfo,
              hiddenFields: person.hiddenFields
            });
            markSaved('about');
          }}
        >
          {sectionBtnLabel('about','Save about this person')}
        </Button>

        <Divider className={styles.sectionDivider}>Relationships</Divider>

        <FieldRow
          label="Father"
          hidden={fieldHidden(person, 'father')}
          onToggleHidden={(checked) => updateHiddenField('relationships', 'father', checked)}
        >
          <InputPicker
            data={fatherOptions}
            value={currentFather.name || ''}
            onChange={(val) => setRelSingle('father', val)}
            onSearch={(kw) => setFatherSearch(kw)}
            placeholder="Type or select"
            searchable
            cleanable
            creatable
            block
            renderMenuItem={renderPersonOption}
          />
          {currentFather.name ? (
            <div className={styles.relationshipPhotos}>
              <div className={styles.relationshipPhotoRow}>
                <div className={styles.relationshipPhotoName}>{currentFather.name}</div>
                <Input value={currentFather.photo || ''} onChange={(val) => setRelSinglePhoto('father', val)} placeholder="Image URL (optional)" />
              </div>
            </div>
          ) : null}
        </FieldRow>

        <FieldRow
          label="Mother"
          hidden={fieldHidden(person, 'mother')}
          onToggleHidden={(checked) => updateHiddenField('relationships', 'mother', checked)}
        >
          <InputPicker
            data={motherOptions}
            value={currentMother.name || ''}
            onChange={(val) => setRelSingle('mother', val)}
            onSearch={(kw) => setMotherSearch(kw)}
            placeholder="Type or select"
            searchable
            cleanable
            creatable
            block
            renderMenuItem={renderPersonOption}
          />
          {currentMother.name ? (
            <div className={styles.relationshipPhotos}>
              <div className={styles.relationshipPhotoRow}>
                <div className={styles.relationshipPhotoName}>{currentMother.name}</div>
                <Input value={currentMother.photo || ''} onChange={(val) => setRelSinglePhoto('mother', val)} placeholder="Image URL (optional)" />
              </div>
            </div>
          ) : null}
        </FieldRow>

        <MultiRel label="Children" field="children" options={childrenOptions} searchSetter={setChildrenSearch} valueArr={childrenArr} searchValue={childrenSearch} />
        <MultiRel label="Siblings" field="siblings" options={siblingsOptions} searchSetter={setSiblingsSearch} valueArr={siblingsArr} searchValue={siblingsSearch} />
        <MultiRel label="Girlfriends" field="girlfriends" options={girlfriendsOptions} searchSetter={setGirlfriendsSearch} valueArr={girlfriendsArr} searchValue={girlfriendsSearch} />
        <MultiRel label="Boyfriends" field="boyfriends" options={boyfriendsOptions} searchSetter={setBoyfriendsSearch} valueArr={boyfriendsArr} searchValue={boyfriendsSearch} />
        <MultiRel label="Husbands" field="husbands" options={husbandsOptions} searchSetter={setHusbandsSearch} valueArr={husbandsArr} searchValue={husbandsSearch} />
        <MultiRel label="Wives" field="wives" options={wivesOptions} searchSetter={setWivesSearch} valueArr={wivesArr} searchValue={wivesSearch} />

        <MultiRel label="Step fathers" field="stepFathers" options={stepFathersOptions} searchSetter={setStepFathersSearch} valueArr={stepFathersArr} searchValue={stepFathersSearch} />
        <MultiRel label="Step mothers" field="stepMothers" options={stepMothersOptions} searchSetter={setStepMothersSearch} valueArr={stepMothersArr} searchValue={stepMothersSearch} />
        <MultiRel label="Foster parents" field="fosterParents" options={fosterParentsOptions} searchSetter={setFosterParentsSearch} valueArr={fosterParentsArr} searchValue={fosterParentsSearch} />
        <MultiRel label="Foster children" field="fosterChildren" options={fosterChildrenOptions} searchSetter={setFosterChildrenSearch} valueArr={fosterChildrenArr} searchValue={fosterChildrenSearch} />
        <MultiRel label="Adoptive parents" field="adoptiveParents" options={adoptiveParentsOptions} searchSetter={setAdoptiveParentsSearch} valueArr={adoptiveParentsArr} searchValue={adoptiveParentsSearch} />
        <MultiRel label="Adopted children" field="adoptedChildren" options={adoptedChildrenOptions} searchSetter={setAdoptedChildrenSearch} valueArr={adoptedChildrenArr} searchValue={adoptedChildrenSearch} />

        <Button
          appearance="primary"
          className={sectionBtnClass('relationships')}
          block
          onClick={() => {
            onSaveSection?.({
              father: person.father,
              mother: person.mother,
              children: person.children,
              siblings: person.siblings,
              girlfriends: person.girlfriends,
              boyfriends: person.boyfriends,
              husbands: person.husbands,
              wives: person.wives,
              stepFathers: person.stepFathers,
              stepMothers: person.stepMothers,
              fosterParents: person.fosterParents,
              fosterChildren: person.fosterChildren,
              adoptiveParents: person.adoptiveParents,
              adoptedChildren: person.adoptedChildren,
              hiddenFields: person.hiddenFields
            });
            markSaved('relationships');
          }}
        >
          {sectionBtnLabel('relationships','Save relationships')}
        </Button>
      </Form>
    </div>
  );
}

export default memo(StandardPersonFields);
