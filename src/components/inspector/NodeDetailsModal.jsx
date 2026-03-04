import React from "react";
import { Modal, Button, Divider } from "rsuite";
import styles from "./NodeDetailsModal.module.css";
import { useAppState } from "../../context/AppStateContext";
import { ACTIONS } from "../../context/appReducer";
import { formatLifeRange } from "../../utils/date";
import { NODE_TYPES } from "../../utils/nodeFactory";

export default function NodeDetailsModal() {
  const { state, dispatch } = useAppState();
  const node = state.nodes.find((item) => item.id === state.activeNodeId);
  if (!node) return null;
  const nodeType = node.data.nodeType || NODE_TYPES.STANDARD;

  return (
    <Modal
      open={state.isNodeModalOpen}
      onClose={() => dispatch({ type: ACTIONS.CLOSE_NODE_MODAL })}
      className={styles.modal}
      backdropClassName={styles.backdrop}
      overflow={false}
    >
      <Modal.Header>
        <Modal.Title>{node.data.title || "Untitled Node"}</Modal.Title>
      </Modal.Header>
      <Modal.Body className={styles.body}>
        {nodeType === NODE_TYPES.STANDARD && node.data.photo && (
          <div className={styles.imageWrap}>
            <img
              src={node.data.photo}
              alt={node.data.title}
              className={styles.image}
            />
          </div>
        )}

        {nodeType === NODE_TYPES.STANDARD && node.data.photoCaption && (
          <div className={styles.caption}>{node.data.photoCaption}</div>
        )}
        {nodeType === NODE_TYPES.STANDARD &&
          (node.data.location || node.data.eventDate) && (
            <div className={styles.metaRow}>
              {node.data.location && <span>{node.data.location}</span>}
              {node.data.eventDate && <span>{node.data.eventDate}</span>}
            </div>
          )}

        {nodeType !== NODE_TYPES.STANDARD && (
          <>
            <Divider>
              {nodeType === NODE_TYPES.PARENTS
                ? "People in this parent node"
                : "People in this node"}
            </Divider>
            <div className={styles.peopleList}>
              {(node.data.people || []).map((person) => (
                <article className={styles.personCard} key={person.id}>
                  {person.photo && (
                    <div className={styles.personImageWrap}>
                      <img
                        src={person.photo}
                        alt={person.fullName || "Person"}
                        className={styles.personImage}
                      />
                    </div>
                  )}
                  <div className={styles.personName}>
                    {person.fullName || "Unnamed Person"}
                  </div>
                  <div className={styles.life}>
                     {formatLifeRange(person.birthDate, person.deathDate).length > 1 ? (
                      <p>{formatLifeRange(person.birthDate, person.deathDate)[1]}</p>
                    ) : <></>}
                    <p>{formatLifeRange(person.birthDate, person.deathDate)[0]}</p>
                  </div>
                  {person.relationshipToPrimary &&
                    nodeType === NODE_TYPES.PARENTS &&
                    person.relationshipToPrimary !== "primary" && (
                      <div>
                        <strong>Relationship to primary person:</strong>{" "}
                        {person.relationshipToPrimary}
                      </div>
                    )}
                  {person.occupation && (
                    <div>
                      <strong>Occupation:</strong> {person.occupation}
                    </div>
                  )}
                  {person.relationLabel && (
                    <div>
                      <strong>Relation label:</strong> {person.relationLabel}
                    </div>
                  )}
                  {person.biography && (
                    <div>
                    
                        <strong><Divider>More about {person.fullName}</Divider></strong>
                      <p className={styles.moreBio}>{person.biography}</p>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </>
        )}

        {node.data.notes && (
          <>
            <Divider>About {node.data.title}</Divider>
            <div className={styles.notes}>{node.data.notes}</div>
          </>
        )}
      </Modal.Body>
      <Modal.Footer className={styles.footer}>
        <Button
          appearance="subtle"
          onClick={() => dispatch({ type: ACTIONS.CLOSE_NODE_MODAL })}
        >
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
