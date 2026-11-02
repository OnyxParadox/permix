
pipeline {
    agent any

    environment {
        APP_NAME = 'permix'
        DOCKER_IMAGE = 'permix:latest'
        PREVIOUS_IMAGE = 'permix:previous'
        CONTAINER_NAME = 'permix-jenkins-test'
        HOST_PORT = '8083'
        DEPLOYMENT_ATTEMPTED = 'false'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install Dependencies') {
            agent {
                docker {
                    image 'node:20-alpine'
                    reuseNode true
                }
            }
            steps {
                sh 'npm ci'
            }
        }

        stage('Lint') {
            agent {
                docker {
                    image 'node:20-alpine'
                    reuseNode true
                }
            }
            steps {
                sh 'npm run lint'
            }
        }

        stage('Build Application') {
            agent {
                docker {
                    image 'node:20-alpine'
                    reuseNode true
                }
            }
            steps {
                sh 'npm run build'
            }
        }

        stage('Backup Previous Image') {
            steps {
                sh '''
                    if docker image inspect ${DOCKER_IMAGE} >/dev/null 2>&1; then
                        docker tag ${DOCKER_IMAGE} ${PREVIOUS_IMAGE}
                        echo "Previous image backed up as ${PREVIOUS_IMAGE}"
                    else
                        echo "No existing image found. Skipping backup."
                    fi
                '''
            }
        }

        stage('Build Docker Image') {
            steps {
                sh 'docker build -t ${DOCKER_IMAGE} .'
            }
        }

        stage('Deploy Application') {
            steps {
                script {
                    env.DEPLOYMENT_ATTEMPTED = 'true'
                }

                sh '''
                    docker stop ${CONTAINER_NAME} || true
                    docker rm ${CONTAINER_NAME} || true

                    docker run -d \
                        --name ${CONTAINER_NAME} \
                        -p ${HOST_PORT}:80 \
                        ${DOCKER_IMAGE}
                '''
            }
        }

        stage('Verify Deployment') {
            steps {
                sh '''
                    sleep 5

                    curl --fail 
                        http://host.docker.internal:8084
                '''
            }
        }
    }

    post {
        failure {
            script {
                if (env.DEPLOYMENT_ATTEMPTED == 'true') {
                    echo 'Deployment failed. Starting rollback...'

                    sh '''
                        if docker image inspect ${PREVIOUS_IMAGE} >/dev/null 2>&1; then
                            docker stop ${CONTAINER_NAME} || true
                            docker rm ${CONTAINER_NAME} || true

                            docker run -d \
                                --name ${CONTAINER_NAME} \
                                -p ${HOST_PORT}:80 \
                                ${PREVIOUS_IMAGE}

                            echo "Rollback container started."

                            sleep 5

                            curl --fail \
                                http://host.docker.internal:${HOST_PORT}

                            echo "Rollback verification successful."
                        else
                            echo "No previous image available. Rollback skipped."
                        fi
                    '''
                } else {
                    echo 'Pipeline failed before deployment. Rollback skipped.'
                }
            }
        }

        success {
            echo 'Pipeline completed successfully!'
        }
    }
}
