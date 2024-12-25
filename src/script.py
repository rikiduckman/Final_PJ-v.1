import sys
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.neural_network import MLPClassifier
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score
from sklearn.preprocessing import StandardScaler
from sklearn.impute import SimpleImputer
import arff

def train_model(filepath, user_data=None):
    try:
        # Load ARFF file with utf-8 encoding
        with open(filepath, 'r', encoding='utf-8') as file:
            dataset = arff.load(file)
    except FileNotFoundError:
        print(f"Error: The file '{filepath}' was not found.")
        return
    except Exception as e:
        print(f"An error occurred while loading the file: {e}")
        return

    # Assume last attribute is the class label
    data = dataset['data']
    X = [row[:-1] for row in data]
    y = [row[-1] for row in data]

    # Convert missing values represented as '?' to NaN for numerical processing
    X = [[np.nan if val == '?' else val for val in row] for row in X]

    # Convert all values to floats
    X = np.array(X, dtype=float)
    y = np.array(y, dtype=float)

    # Impute missing values with the mean of each column
    imputer = SimpleImputer(strategy='mean')
    X = imputer.fit_transform(X)

    # Split the data with a fixed random_state for consistency
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=97, shuffle=True)

    # Normalize data
    scaler = StandardScaler()
    X_train = scaler.fit_transform(X_train)
    X_test = scaler.transform(X_test)

    clf = MLPClassifier(
        hidden_layer_sizes=(400,300,250),   # Adjusted number of nodes in each layer
        max_iter=8000,                  # Increased max iterations for thorough training
        solver='adam',
        learning_rate_init=0.00005,         # Reduced learning rate for finer adjustments
        alpha=0.000001,                     # Lower regularization term for flexibility
        early_stopping=True,
        tol=1e-5,                        # Adjusted tolerance for better training
        batch_size=16,                   # Reduced batch size for more frequent updates
        random_state=97
    )
    
    try:
        clf.fit(X_train, y_train)
    except Exception as e:
        print(f"An error occurred while training the model: {e}")
        return

    # Predict and evaluate
    y_pred = clf.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred, average='weighted')
    precision = precision_score(y_test, y_pred, average='weighted', zero_division=1)
    recall = recall_score(y_test, y_pred, average='weighted')
    
    # Define a mapping for the prediction
    prediction_mapping = {0.0: 'CS', 1.0: 'IT'}

    # Predict for user data if provided
    user_prediction = None
    if user_data:
        try:
            # Convert user data to floats and replace missing values
            user_data = [np.nan if val == '?' else float(val) for val in user_data]
            # Impute missing values in user data
            user_data = imputer.transform([user_data])[0]
            # Normalize user data
            user_data = scaler.transform([user_data])[0]
            
            # Predict the result
            user_prediction = clf.predict([user_data])[0]
            # Map the numeric prediction to its label
            user_prediction_label = prediction_mapping.get(user_prediction, 'Unknown')
        except NotFittedError as e:
            print(f"Model is not fitted yet: {e}")
            return
        except Exception as e:
            print(f"An error occurred while predicting user data: {e}")
            return
    
    # Print the metrics and prediction
    print(f'Accuracy: {round(accuracy * 100)}%')
    print(f'F1-Score: {round(f1 * 100)}%')
    print(f'Precision: {round(precision * 100)}%')
    print(f'Recall: {round(recall * 100)}%')

    
    if user_prediction is not None:
        print(f'Prediction: {user_prediction_label}')

if __name__ == '__main__':
    filepath = sys.argv[1]
    user_data = sys.argv[2:] if len(sys.argv) > 2 else None
    train_model(filepath, user_data)
